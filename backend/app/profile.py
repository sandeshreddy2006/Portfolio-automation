"""Reusable account details and owner-controlled résumé downloads."""

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select

from app import media
from app.auth import throttle
from app.models import Portfolio, Upload, User
from app.portfolios import Database, require_user, validated_profile
from app.schemas import ProfileContent, ProfileDetails
from app.uploads import read_body

router = APIRouter(prefix="/api", tags=["profile"])
logger = logging.getLogger(__name__)
PRIVATE_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


def details(user: User) -> dict:
    return {
        "content": media.normalize_images(user.profile_content or {"name": user.name}, user.id),
        "email": user.email,
        "google_connected": user.google_connected,
        "resume_id": user.resume_id,
    }


@router.get("/profile", response_model=ProfileDetails)
def get_profile(request: Request, db: Database):
    return details(require_user(request, db))


@router.put("/profile", response_model=ProfileDetails)
def save_profile(body: ProfileContent, request: Request, db: Database, background: BackgroundTasks):
    user = require_user(request, db)
    media.lock_portfolio_media(db, user.id)
    db.refresh(user)
    document = validated_profile(body, user, db)
    released = media.image_keys(user.id, user.profile_content) - media.image_keys(user.id, document)
    user.profile_content = document
    db.commit()
    background.add_task(media.cleanup_user_media, user.id, released=released)
    return details(user)


def replace_resume(db, user_id: int, data: bytes, background: BackgroundTasks) -> dict:
    throttle(db, "resume", str(user_id), 20, 3600)
    db.commit()
    media.lock_portfolio_media(db, user_id)
    user = db.get(User, user_id, populate_existing=True)
    if user is None:
        raise HTTPException(401, "Sign in to manage your résumé.")
    previous = user.resume_id
    resume_id = uuid.uuid4().hex
    key = media.resume_key(user.id, resume_id)
    try:
        media.store(key, data, "application/pdf")
    except Exception as error:
        logger.warning("Résumé storage failed (%s)", type(error).__name__)
        raise HTTPException(503, "We couldn’t store the résumé. Please try again.") from error
    user.resume_id = resume_id
    db.add(Upload(owner_id=user_id, key=key, size=len(data)))
    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            media.remove([key])
        except Exception as error:
            logger.warning("Résumé cleanup failed (%s)", type(error).__name__)
        raise
    if previous:
        background.add_task(media.cleanup_user_media, user_id, released={media.resume_key(user_id, previous)})
    return {"resume_id": resume_id}


@router.post("/profile/resume", status_code=201)
async def upload_resume(request: Request, db: Database, background: BackgroundTasks):
    user = await run_in_threadpool(require_user, request, db)
    if not media.storage_available():
        raise HTTPException(503, "Résumé storage is unavailable.")
    if request.headers.get("content-type") != "application/pdf":
        raise HTTPException(415, "Choose a PDF résumé.")
    data = await read_body(request, "PDF")
    if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-1024:]:
        raise HTTPException(422, "That file isn’t a valid PDF.")
    return await run_in_threadpool(replace_resume, db, user.id, data, background)


@router.delete("/profile/resume", status_code=204)
def remove_resume(request: Request, db: Database, background: BackgroundTasks):
    user = require_user(request, db)
    media.lock_portfolio_media(db, user.id)
    db.refresh(user)
    if user.resume_id:
        released = {media.resume_key(user.id, user.resume_id)}
        user.resume_id = None
        db.commit()
        background.add_task(media.cleanup_user_media, user.id, released=released)
    return Response(status_code=204, headers=PRIVATE_HEADERS)


def download_resume(user_id: int, resume_id: str | None):
    if not resume_id:
        raise HTTPException(404, "Résumé not found.", headers=PRIVATE_HEADERS)
    try:
        data = media.read_media(media.resume_key(user_id, resume_id))
    except FileNotFoundError:
        raise HTTPException(404, "Résumé not found.", headers=PRIVATE_HEADERS) from None
    except Exception as error:
        logger.warning("Résumé download failed (%s)", type(error).__name__)
        raise HTTPException(503, "Résumé unavailable.", headers=PRIVATE_HEADERS) from error
    return Response(data, media_type="application/pdf", headers={
        **PRIVATE_HEADERS, "Content-Disposition": 'attachment; filename="resume.pdf"',
    })


@router.get("/profile/resume")
def private_resume(request: Request, db: Database):
    user = require_user(request, db)
    return download_resume(user.id, user.resume_id)


@router.get("/public/{slug}/resume")
def public_resume(slug: str, db: Database):
    row = db.execute(
        select(Portfolio, User.resume_id).join(User, User.id == Portfolio.owner_id)
        .where(Portfolio.slug == slug, Portfolio.published_content.is_not(None))
    ).one_or_none()
    if row is None:
        raise HTTPException(404, "Résumé not found.", headers=PRIVATE_HEADERS)
    portfolio, resume_id = row
    if not resume_id or portfolio.published_content.get("resume_id") != resume_id:
        raise HTTPException(404, "Résumé not found.", headers=PRIVATE_HEADERS)
    return download_resume(portfolio.owner_id, resume_id)
