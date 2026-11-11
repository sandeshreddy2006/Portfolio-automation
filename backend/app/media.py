"""Validate, re-encode and store user images.

Production stores them in Cloudflare R2 (S3 compatible). Local development
without R2 settings falls back to the backend/uploads folder.
"""

import io
import logging
import os
import re
import warnings
from functools import lru_cache

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.db import BACKEND_DIR

LOCAL_DIR = BACKEND_DIR / "uploads"
MAX_UPLOAD_BYTES = 4 * 1024 * 1024
MAX_PIXELS = 40_000_000
# Longest side, in pixels, for each kind of image.
KINDS = {"avatar": 800, "project": 1600}
ACCEPTED_FORMATS = {"JPEG", "PNG", "WEBP"}
KEY_PATTERN = re.compile(r"[0-9a-f]{32}\.webp")

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def r2_configured() -> bool:
    return all(
        os.getenv(name)
        for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL")
    )


def local_development() -> bool:
    return (os.getenv("FRONTEND_URL") or "http://localhost:3000").startswith("http://localhost")


def storage_available() -> bool:
    return r2_configured() or local_development()


def media_base() -> str:
    """Public URL prefix every stored image lives under."""
    if r2_configured():
        return os.environ["R2_PUBLIC_URL"].rstrip("/")
    return (os.getenv("BACKEND_PUBLIC_URL") or "http://127.0.0.1:8000").rstrip("/") + "/media"


def owned_media_url(url: str | None, user_id: int) -> bool:
    """True only for an image this server stored for this user."""
    prefix = f"{media_base()}/u{user_id}/"
    return bool(url) and url.startswith(prefix) and KEY_PATTERN.fullmatch(url[len(prefix):]) is not None


def process_image(data: bytes, kind: str) -> bytes:
    """Decode, fix rotation, shrink, drop all metadata and return WebP bytes."""
    if kind not in KINDS:
        raise HTTPException(422, "Unknown image type.")
    try:
        with warnings.catch_warnings():
            # A decompression-bomb warning is treated as an error.
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if source.format not in ACCEPTED_FORMATS:
                    raise HTTPException(415, "Please upload a JPEG, PNG or WebP image.")
                image = ImageOps.exif_transpose(source)
                image.load()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise HTTPException(422, "That file isn’t a valid image.") from error

    side = KINDS[kind]
    image.thumbnail((side, side), Image.Resampling.LANCZOS)
    has_alpha = "A" in image.getbands() or "transparency" in image.info
    image = image.convert("RGBA" if has_alpha else "RGB")
    output = io.BytesIO()
    # Re-encoding writes a fresh file with no EXIF/GPS or other embedded data.
    image.save(output, "WEBP", quality=82, method=4)
    return output.getvalue()


@lru_cache
def r2_client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(retries={"max_attempts": 3}, connect_timeout=5, read_timeout=15),
    )


def store(key: str, data: bytes) -> None:
    if r2_configured():
        r2_client().put_object(
            Bucket=os.environ["R2_BUCKET"], Key=key, Body=data, ContentType="image/webp",
            # File names are random and never reused, so browsers may cache them forever.
            CacheControl="public, max-age=31536000, immutable",
        )
        return
    path = LOCAL_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def remove(keys: list[str]) -> None:
    if not keys:
        return
    if r2_configured():
        for start in range(0, len(keys), 1000):
            r2_client().delete_objects(
                Bucket=os.environ["R2_BUCKET"],
                Delete={"Objects": [{"Key": key} for key in keys[start:start + 1000]], "Quiet": True},
            )
        return
    for key in keys:
        (LOCAL_DIR / key).unlink(missing_ok=True)


def purge_user_media(db, user_id: int) -> None:
    """Best-effort removal of every stored image for a user who is deleting their account."""
    from sqlalchemy import select

    from app.models import Upload

    keys = list(db.scalars(select(Upload.key).where(Upload.owner_id == user_id)))
    try:
        remove(keys)
    except Exception as error:  # the account deletion must still go through
        logging.getLogger(__name__).warning("Image cleanup failed (%s)", type(error).__name__)


def cleanup_user_media(user_id: int, min_age_seconds: int = 3600) -> None:
    """Delete a user's stored images that no portfolio (draft or published) uses any more.

    Images uploaded in the last hour are kept, so an upload that hasn't been saved
    into a draft yet is never removed by an unrelated save.
    """
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import delete, select

    from app.db import SessionLocal
    from app.models import Portfolio, Upload

    try:
        with SessionLocal() as db:
            prefix = media_base() + "/"
            used: set[str] = set()
            for documents in db.execute(
                select(Portfolio.draft_content, Portfolio.published_content).where(Portfolio.owner_id == user_id)
            ):
                for content in documents:
                    if not content:
                        continue
                    urls = [content.get("avatar"), *(project.get("image") for project in content.get("projects", []))]
                    used.update(url.removeprefix(prefix) for url in urls if url)

            cutoff = datetime.now(timezone.utc) - timedelta(seconds=min_age_seconds)
            stale = []
            for upload in db.scalars(select(Upload).where(Upload.owner_id == user_id)):
                created = upload.created_at if upload.created_at.tzinfo else upload.created_at.replace(tzinfo=timezone.utc)
                if upload.key not in used and created < cutoff:
                    stale.append(upload)
            if not stale:
                return
            remove([upload.key for upload in stale])
            db.execute(delete(Upload).where(Upload.id.in_([upload.id for upload in stale])))
            db.commit()
    except Exception as error:  # background housekeeping must never surface as an error
        logging.getLogger(__name__).warning("Image cleanup failed (%s)", type(error).__name__)