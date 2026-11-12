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
from urllib.parse import urlsplit

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
        for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
    )


def local_development() -> bool:
    return (os.getenv("FRONTEND_URL") or "http://localhost:3000").startswith("http://localhost")


def storage_available() -> bool:
    return r2_configured() or local_development()


def media_base() -> str:
    """Site-relative URL prefix for all uploaded images."""
    return "/media"


def image_key(url: str | None, user_id: int | None) -> str | None:
    if not url or user_id is None:
        return None
    try:
        parsed = urlsplit(url)
    except ValueError:
        return None
    parts = parsed.path.rsplit("/", 2)
    if len(parts) != 3:
        return None
    prefix, folder, filename = parts
    if (parsed.query or parsed.fragment or folder != f"u{user_id}"
            or not KEY_PATTERN.fullmatch(filename)):
        return None
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        # Legacy records contain an absolute R2 or local URL. Only reuse its key.
        if {"..", "."}.intersection(parsed.path.split("/")):
            return None
    elif parsed.scheme or parsed.netloc or prefix != media_base():
        return None
    return f"{folder}/{filename}"


def resume_key(user_id: int, resume_id: str) -> str:
    return f"u{user_id}/{resume_id}.pdf"


def image_urls(content: dict):
    yield content.get("avatar")
    for project in content.get("projects", []):
        yield project.get("image")


def image_keys(user_id: int, *documents: dict | None) -> set[str]:
    return {
        key for document in documents if document
        for url in image_urls(document) if (key := image_key(url, user_id))
    }


def lock_portfolio_media(db, user_id: int) -> None:
    """Serialize reference changes and cleanup for an owner's images."""
    from sqlalchemy import select, update

    from app.models import User

    if db.get_bind().dialect.name == "sqlite":
        db.execute(update(User).where(User.id == user_id).values(id=User.id))
    else:
        db.scalar(select(User.id).where(User.id == user_id).with_for_update())


def normalize_images(content: dict, user_id: int | None) -> dict:
    def canonical(url):
        key = image_key(url, user_id)
        return f"{media_base()}/{key}" if key else None

    avatar = canonical(content.get("avatar"))
    projects = []
    for project in content.get("projects", []):
        image = canonical(project.get("image"))
        projects.append({**project, "image": image, "image_framing": project.get("image_framing") if image else None})
    return {
        **content, "avatar": avatar, "avatar_framing": content.get("avatar_framing") if avatar else None,
        "projects": projects,
    }


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


def store(key: str, data: bytes, content_type: str = "image/webp") -> None:
    if r2_configured():
        r2_client().put_object(
            Bucket=os.environ["R2_BUCKET"], Key=key, Body=data, ContentType=content_type,
        )
        return
    path = LOCAL_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def read_media(key: str) -> bytes:
    if r2_configured():
        from botocore.exceptions import ClientError

        try:
            body = r2_client().get_object(Bucket=os.environ["R2_BUCKET"], Key=key)["Body"]
        except ClientError as error:
            if error.response["Error"]["Code"] in {"NoSuchKey", "404", "NotFound"}:
                raise FileNotFoundError(key) from error
            raise
        try:
            return body.read()
        finally:
            body.close()
    return (LOCAL_DIR / key).read_bytes()


def remove(keys: list[str]) -> None:
    if not keys:
        return
    if r2_configured():
        for start in range(0, len(keys), 1000):
            result = r2_client().delete_objects(
                Bucket=os.environ["R2_BUCKET"],
                Delete={"Objects": [{"Key": key} for key in keys[start:start + 1000]], "Quiet": True},
            )
            if result.get("Errors"):
                raise RuntimeError("R2 could not remove every requested image.")
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


def cleanup_user_media(user_id: int, min_age_seconds: int = 3600, *, released: set[str] | None = None) -> None:
    """Delete a user's stored images that no portfolio (draft or published) uses any more.

    Remove released references immediately. Keep newly uploaded files that might
    still be waiting for their first draft save.
    """
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import delete, select

    from app.db import SessionLocal
    from app.models import Portfolio, Upload, User

    try:
        with SessionLocal() as db:
            lock_portfolio_media(db, user_id)
            used = {
                key for documents in db.execute(
                    select(Portfolio.draft_content, Portfolio.published_content).where(Portfolio.owner_id == user_id)
                )
                for key in image_keys(user_id, *documents)
            }
            profile_content, resume_id = db.execute(
                select(User.profile_content, User.resume_id).where(User.id == user_id)
            ).one_or_none() or (None, None)
            used.update(image_keys(user_id, profile_content))
            if resume_id:
                used.add(resume_key(user_id, resume_id))
            released = released or set()
            cutoff = datetime.now(timezone.utc) - timedelta(seconds=min_age_seconds)
            stale = []
            for upload in db.scalars(select(Upload).where(Upload.owner_id == user_id)):
                created = upload.created_at if upload.created_at.tzinfo else upload.created_at.replace(tzinfo=timezone.utc)
                if upload.key not in used and (upload.key in released or created < cutoff):
                    stale.append(upload)
            if not stale:
                return
            remove([upload.key for upload in stale])
            db.execute(delete(Upload).where(Upload.id.in_([upload.id for upload in stale])))
            db.commit()
    except Exception as error:  # background housekeeping must never surface as an error
        logging.getLogger(__name__).warning("Image cleanup failed (%s)", type(error).__name__)
