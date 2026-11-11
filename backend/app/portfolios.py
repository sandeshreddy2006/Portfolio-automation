"""Create, edit, publish and serve portfolios."""

import time
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import current_user, throttle
from app.auth_email import send_portfolio_live
from app.db import get_db
from app.google_oauth import frontend_origin
from app.media import cleanup_user_media, owned_media_url
from app.models import Portfolio, User
from app.models import SlugHold
from app.slugs import hold_slug, is_held_for_someone_else, stop_redirects_to
from app.schemas import (
    PortfolioContent,
    PortfolioCreate,
    PortfolioDetail,
    PortfolioRename,
    PortfolioSummary,
    PortfolioUpdate,
    PublicPortfolio,
)

router = APIRouter(prefix="/api", tags=["portfolios"])
Database = Annotated[Session, Depends(get_db)]

MAX_PORTFOLIOS = 5
MIN_SLUG_LENGTH = 3
# Keep in sync with frontend/components/templates/index.ts.
TEMPLATE_IDS = {"editorial", "terminal", "bento", "brutalist", "blocky", "aurora"}
# Names that would collide with site routes or look official.
RESERVED_SLUGS = {
    "admin", "api", "app", "auth", "login", "logout", "signin", "signup", "register",
    "account", "settings", "dashboard", "editor", "p", "templates", "template", "www",
    "mail", "help", "support", "about", "blog", "static", "assets", "portfolabs",
    "portfoliolabs", "root", "null", "undefined",
}


def require_user(request: Request, db: Session) -> User:
    user = current_user(request, db)
    if user is None:
        raise HTTPException(401, "Sign in to manage your portfolios.")
    return user


def check_content(content: PortfolioContent, user: User) -> None:
    if content.template_id not in TEMPLATE_IDS:
        raise HTTPException(422, "Choose one of the available templates.")
    images = [content.avatar, *(project.image for project in content.projects)]
    if any(url and not owned_media_url(url, user.id) for url in images):
        # Only images this server stored for this user may be shown, never arbitrary URLs.
        raise HTTPException(422, "One of the images isnâ€™t valid. Please upload it again.")


def check_new_address(db: Session, slug: str, user: User) -> None:
    if len(slug) < MIN_SLUG_LENGTH:
        raise HTTPException(422, f"Use at least {MIN_SLUG_LENGTH} characters for the address.")
    if slug in RESERVED_SLUGS:
        raise HTTPException(409, "That address is reserved. Please choose another.")
    if is_held_for_someone_else(db, slug, user.id):
        raise HTTPException(409, "That address was used recently and is on hold. Please choose another.")


def owned_portfolio(db: Session, user: User, slug: str) -> Portfolio:
    # Someone else's portfolio looks exactly like a missing one.
    portfolio = db.scalar(
        select(Portfolio).where(Portfolio.slug == slug, Portfolio.owner_id == user.id)
    )
    if portfolio is None:
        raise HTTPException(404, "Portfolio not found.")
    return portfolio


def summarize(portfolio: Portfolio) -> dict:
    return {
        "slug": portfolio.slug,
        "revision": portfolio.revision or 0,
        "template_id": portfolio.draft_content["template_id"],
        "name": portfolio.draft_content["name"],
        "published": portfolio.published_content is not None,
        "has_unpublished_changes": portfolio.published_content != portfolio.draft_content,
        "published_at": portfolio.published_at,
        "updated_at": portfolio.updated_at,
    }


def detail(portfolio: Portfolio) -> dict:
    return {
        **summarize(portfolio),
        "draft_content": portfolio.draft_content,
        "published_content": portfolio.published_content,
    }


@router.get("/portfolios", response_model=list[PortfolioSummary])
def list_portfolios(request: Request, db: Database):
    user = require_user(request, db)
    rows = db.scalars(
        select(Portfolio).where(Portfolio.owner_id == user.id).order_by(Portfolio.created_at)
    )
    return [summarize(row) for row in rows]


@router.post("/portfolios", response_model=PortfolioDetail, status_code=201)
def create_portfolio(body: PortfolioCreate, request: Request, db: Database):
    user = require_user(request, db)
    throttle(db, "create", str(user.id), 30, 3600)
    db.commit()
    check_content(body.draft_content, user)
    check_new_address(db, body.slug, user)

    # Lock the owner's row so two quick requests cannot both slip past the limit.
    db.scalar(select(User.id).where(User.id == user.id).with_for_update())
    count = db.scalar(select(func.count()).select_from(Portfolio).where(Portfolio.owner_id == user.id))
    if count >= MAX_PORTFOLIOS:
        raise HTTPException(409, f"You can have up to {MAX_PORTFOLIOS} portfolios.")

    portfolio = Portfolio(
        owner_id=user.id, slug=body.slug, draft_content=body.draft_content.model_dump(mode="json"),
    )
    db.add(portfolio)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "That address is already taken.") from error
    db.refresh(portfolio)
    return detail(portfolio)


@router.get("/portfolios/{slug}", response_model=PortfolioDetail)
def get_portfolio(slug: str, request: Request, db: Database):
    return detail(owned_portfolio(db, require_user(request, db), slug))


@router.put("/portfolios/{slug}", response_model=PortfolioDetail)
def update_portfolio(
    slug: str, body: PortfolioUpdate, request: Request, db: Database, background: BackgroundTasks,
):
    user = require_user(request, db)
    portfolio = owned_portfolio(db, user, slug)
    throttle(db, "save", str(user.id), 600, 3600)
    db.commit()
    check_content(body.draft_content, user)

    # The save only goes through if nobody else saved since this edit began. The check and the
    # write are one statement, so two simultaneous saves can't both win.
    current = portfolio.revision or 0
    conflict = HTTPException(
        409, "This portfolio was changed in another tab or device. Reload to see the latest version before saving.",
    )
    if body.base_revision is not None and body.base_revision != current:
        raise conflict
    saved = db.execute(
        update(Portfolio)
        .where(Portfolio.id == portfolio.id, func.coalesce(Portfolio.revision, 0) == current)
        .values(draft_content=body.draft_content.model_dump(mode="json"), revision=current + 1)
    )
    if saved.rowcount == 0:
        db.rollback()
        raise conflict
    db.commit()
    db.refresh(portfolio)
    background.add_task(cleanup_user_media, user.id)
    return detail(portfolio)


@router.patch("/portfolios/{slug}/address", response_model=PortfolioDetail)
def rename_portfolio(slug: str, body: PortfolioRename, request: Request, db: Database):
    """Change a portfolio's web address. The old address keeps redirecting to the new one for 30 days."""
    user = require_user(request, db)
    portfolio = owned_portfolio(db, user, slug)
    new = body.slug
    if new == slug:
        return detail(portfolio)
    throttle(db, "rename", str(user.id), 10, 86400)
    db.commit()
    check_new_address(db, new, user)
    if db.scalar(select(Portfolio.id).where(Portfolio.slug == new)) is not None:
        raise HTTPException(409, "That address is already taken.")

    portfolio.slug = new
    mine_again = db.get(SlugHold, new)
    if mine_again is not None:  # reclaiming an address this person let go of earlier
        db.delete(mine_again)
    for earlier in db.scalars(select(SlugHold).where(SlugHold.redirect_to == slug)):
        earlier.redirect_to = new  # a -> b becomes a -> c when b is renamed to c
    hold_slug(db, slug, user.id, redirect_to=new)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "That address is already taken.") from error
    db.refresh(portfolio)
    return detail(portfolio)


@router.post("/portfolios/{slug}/publish", response_model=PortfolioDetail)
def publish_portfolio(slug: str, request: Request, db: Database, background: BackgroundTasks):
    user = require_user(request, db)
    portfolio = owned_portfolio(db, user, slug)
    throttle(db, "publish", str(user.id), 60, 3600)
    db.commit()
    first_time = portfolio.published_at is None
    portfolio.published_content = dict(portfolio.draft_content)
    portfolio.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(portfolio)

    if first_time:
        try:
            # At most two "your portfolio is live" emails per portfolio per hour.
            throttle(db, "live-email", str(portfolio.id), 2, 3600)
            db.commit()
        except HTTPException:
            db.rollback()
        else:
            background.add_task(
                send_portfolio_live, user.email, user.name,
                portfolio.published_content["name"], f"{frontend_origin()}/p/{portfolio.slug}",
            )
    return detail(portfolio)


@router.post("/portfolios/{slug}/unpublish", response_model=PortfolioDetail)
def unpublish_portfolio(slug: str, request: Request, db: Database, background: BackgroundTasks):
    user = require_user(request, db)
    portfolio = owned_portfolio(db, user, slug)
    portfolio.published_content = None
    portfolio.published_at = None
    db.commit()
    db.refresh(portfolio)
    background.add_task(cleanup_user_media, user.id)
    return detail(portfolio)


@router.delete("/portfolios/{slug}", status_code=204)
def delete_portfolio(slug: str, request: Request, db: Database, background: BackgroundTasks):
    user = require_user(request, db)
    portfolio = owned_portfolio(db, user, slug)
    stop_redirects_to(db, slug)
    hold_slug(db, slug, user.id)
    db.delete(portfolio)
    db.commit()
    background.add_task(cleanup_user_media, user.id)
    return Response(status_code=204)


@router.get("/public")
def public_index(db: Database):
    """Published portfolios whose owners allow search engines, for the sitemap."""
    rows = db.execute(
        select(Portfolio.slug, Portfolio.published_at, Portfolio.published_content)
        .where(Portfolio.published_content.is_not(None))
        .order_by(Portfolio.published_at.desc())
        .limit(5000)
    )
    return [
        {"slug": slug, "published_at": published_at}
        for slug, published_at, content in rows
        if content.get("search_visible")
    ]


@router.get("/public/{slug}/redirect")
def public_redirect(slug: str, db: Database):
    """Where an address that was renamed now lives, so old links keep working."""
    hold = db.get(SlugHold, slug)
    if hold is None or not hold.redirect_to or hold.until <= time.time():
        raise HTTPException(404, "Portfolio not found.")
    return {"to": hold.redirect_to}


@router.get("/public/{slug}", response_model=PublicPortfolio)
def public_portfolio(slug: str, db: Database):
    portfolio = db.scalar(select(Portfolio).where(Portfolio.slug == slug))
    if portfolio is None or portfolio.published_content is None:
        raise HTTPException(404, "Portfolio not found.")
    return portfolio

