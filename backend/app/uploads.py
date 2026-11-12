"""Accept image uploads from signed-in users."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import media
from app.auth import current_user, throttle
from app.db import get_db
from app.models import Portfolio, Upload
from app.portfolios import require_user

router = APIRouter(prefix="/api", tags=["uploads"])
media_router = APIRouter(tags=["uploads"])
logger = logging.getLogger(__name__)
Database = Annotated[Session, Depends(get_db)]

MAX_FILES_PER_USER = 60
MAX_BYTES_PER_USER = 60 * 1024 * 1024
MEDIA_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


@media_router.get("/media/{owner_folder}/{filename}")
def serve_image(owner_folder: str, filename: str, request: Request, db: Database):
    missing = HTTPException(404, "Image not found.", headers=MEDIA_HEADERS)
    if (not owner_folder.startswith("u") or not owner_folder[1:].isascii()
            or not owner_folder[1:].isdigit() or not media.KEY_PATTERN.fullmatch(filename)):
        raise missing
    key = f"{owner_folder}/{filename}"
    upload = db.scalar(select(Upload).where(Upload.key == key))
    if upload is None:
        raise missing
    user = current_user(request, db)
    if user is None or user.id != upload.owner_id:
        published = db.scalars(select(Portfolio.published_content).where(
            Portfolio.owner_id == upload.owner_id, Portfolio.published_content.is_not(None),
        ))
        if not any(
            media.image_key(url, upload.owner_id) == key
            for content in published for url in media.image_urls(content)
        ):
            raise missing
    if not media.storage_available():
        raise missing
    try:
        data = media.read_media(key)
    except FileNotFoundError:
        raise missing
    except Exception as error:
        logger.warning("Image read failed (%s)", type(error).__name__)
        raise HTTPException(503, "Image unavailable.", headers=MEDIA_HEADERS) from error
    return Response(data, media_type="image/webp", headers=MEDIA_HEADERS)


async def read_body(request: Request, label: str = "image") -> bytes:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > media.MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"That {label} is too large. Please choose one up to 4 MB.")
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > media.MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"That {label} is too large. Please choose one up to 4 MB.")
        chunks.append(chunk)
    if not total:
        raise HTTPException(422, f"No {label} was received.")
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
