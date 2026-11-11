"""A deleted address stays reserved for a while.

Without this, deleting /p/alex would let anyone claim it immediately, and every link
the first Alex ever shared would start showing someone else's portfolio.
"""

import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Portfolio, SlugHold

HOLD_SECONDS = 30 * 24 * 60 * 60


def hold_slug(db: Session, slug: str, owner_id: int | None, redirect_to: str | None = None) -> None:
    db.merge(SlugHold(slug=slug, owner_id=owner_id, until=int(time.time()) + HOLD_SECONDS, redirect_to=redirect_to))


def stop_redirects_to(db: Session, slug: str) -> None:
    """Old addresses that pointed at a portfolio that is going away stay reserved but stop redirecting."""
    for earlier in db.scalars(select(SlugHold).where(SlugHold.redirect_to == slug)):
        earlier.redirect_to = None


def hold_user_slugs(db: Session, user_id: int) -> None:
    """Reserve every address a deleted account used. Nobody, including the old owner, gets them back."""
    for slug in db.scalars(select(Portfolio.slug).where(Portfolio.owner_id == user_id)):
        stop_redirects_to(db, slug)
        hold_slug(db, slug, None)


def is_held_for_someone_else(db: Session, slug: str, user_id: int) -> bool:
    hold = db.get(SlugHold, slug)
    if hold is None:
        return False
    if hold.until <= time.time():
        db.delete(hold)
        return False
    return hold.owner_id != user_id
