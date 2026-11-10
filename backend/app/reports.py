"""Let visitors report a portfolio, and tell the site owner."""

import html
import logging
import os
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import throttle
from app.auth_email import deliver_account_email
from app.db import get_db
from app.models import Portfolio, Report
from app.schemas import ReportCreate, Slug

router = APIRouter(prefix="/api", tags=["reports"])
logger = logging.getLogger(__name__)
Database = Annotated[Session, Depends(get_db)]


def notify_owner(slug: str, report: ReportCreate) -> None:
    recipient = os.getenv("REPORT_EMAIL")
    if not recipient:
        return
    lines = [f"Portfolio: /p/{slug}", f"Reason: {report.reason}", f"Contact: {report.contact or 'not given'}", "", report.details or "(no details)"]
    try:
        deliver_account_email(
            recipient, f"Portfolabs report: /p/{slug}",
            "<br>".join(html.escape(line) for line in lines), plain="\n".join(lines),
        )
    except (OSError, KeyError, ValueError) as error:
        logger.warning("Report notification failed (%s)", type(error).__name__)


@router.post("/public/{slug}/report", status_code=201)
def report_portfolio(slug: Slug, body: ReportCreate, db: Database, background: BackgroundTasks):
    # Reports are anonymous, so the limits are per portfolio and overall, not per person.
    throttle(db, "report-slug", slug, 5, 86400)
    throttle(db, "report-all", "all", 200, 86400)
    db.commit()
    published = db.scalar(select(Portfolio.id).where(Portfolio.slug == slug, Portfolio.published_content.is_not(None)))
    if published is None:
        raise HTTPException(404, "Portfolio not found.")
    db.add(Report(slug=slug, reason=body.reason, details=body.details.strip(), contact=body.contact))
    db.commit()
    background.add_task(notify_owner, slug, body)
    return {"received": True}
