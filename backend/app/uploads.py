"""Accept image uploads from signed-in users."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import media
from app.auth import throttle
from app.db import get_db
from app.models import Upload
from app.portfolios import require_user

router = APIRouter(prefix="/api", tags=["uploads"])
logger = logging.getLogger(__name__)
Database = Annotated[Session, Depends(get_db)]

MAX_FILES_PER_USER = 60
MAX_BYTES_PER_USER = 60 * 1024 * 1024


async def read_body(request: Request) -> bytes:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > media.MAX_UPLOAD_BYTES:
        raise HTTPException(413, "That image is too large. Please choose one under 4 MB.")
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > media.MAX_UPLOAD_BYTES:
            raise HTTPException(413, "That image is too large. Please choose one under 4 MB.")
        chunks.append(chunk)
    if not total:
        raise HTTPException(422, "No image was received.")
    return b"".join(chunks)


def save_image(db: Session, user_id: int, data: bytes, kind: str) -> dict:
    throttle(db, "upload", str(user_id), 40, 3600)
    db.commit()
    used, size = db.execute(
        select(func.count(Upload.id), func.coalesce(func.sum(Upload.size), 0)).where(Upload.owner_id == user_id)
    ).one()
    if used >= MAX_FILES_PER_USER or size >= MAX_BYTES_PER_USER:
        raise HTTPException(409, "You’ve reached your image limit. Remove some images and try again.")

    encoded = media.process_image(data, kind)
    key = f"u{user_id}/{uuid.uuid4().hex}.webp"
    try:
        media.store(key, encoded)
    except Exception as error:  # boto3 raises many error types; the user only needs a retry
        logger.warning("Image storage failed (%s)", type(error).__name__)
        raise HTTPException(503, "We couldn’t save that image. Please try again.") from error

    db.add(Upload(owner_id=user_id, key=key, size=len(encoded)))
    try:
        db.commit()
    except Exception:
        db.rollback()
        media.remove([key])
        raise
    return {"url": f"{media.media_base()}/{key}"}


@router.post("/uploads", status_code=201)
async def upload_image(request: Request, db: Database, kind: str = "project"):
    user = await run_in_threadpool(require_user, request, db)
    if not media.storage_available():
        raise HTTPException(503, "Image uploads aren’t available right now.")
    if not (request.headers.get("content-type") or "").startswith("image/"):
        raise HTTPException(415, "Please upload a JPEG, PNG or WebP image.")
    data = await read_body(request)
    return await run_in_threadpool(save_image, db, user.id, data, kind)
