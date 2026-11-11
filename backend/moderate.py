"""Owner-only moderation tool. Run it where the backend's environment variables are set.

    python moderate.py reports              list recent reports, newest first
    python moderate.py unpublish <address>  take a portfolio offline right away

Unpublishing also asks the website to drop its cached copy, so the page disappears
immediately. That needs FRONTEND_URL and REVALIDATE_SECRET to be set (the secret must
match the one on the website).
"""

import json
import os
import sys
from urllib.request import Request, urlopen

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Portfolio, Report


def refresh_website(slug: str) -> None:
    secret = os.getenv("REVALIDATE_SECRET")
    origin = (os.getenv("FRONTEND_URL") or "").split(",")[0].strip().rstrip("/")
    if not secret or not origin:
        print("Note: REVALIDATE_SECRET/FRONTEND_URL not set, so the cached page can stay visible for up to an hour.")
        return
    request = Request(
        f"{origin}/api/revalidate", data=json.dumps({"slug": slug}).encode(), method="POST",
        headers={"Content-Type": "application/json", "x-revalidate-secret": secret, "User-Agent": "Portfolabs-moderation"},
    )
    try:
        with urlopen(request, timeout=10):
            print("Website cache refreshed.")
    except OSError as error:
        print(f"Warning: could not refresh the website cache ({error}). The page may stay visible for up to an hour.")


def main(arguments: list[str]) -> int:
    if arguments[:1] == ["reports"]:
        with SessionLocal() as db:
            for report in db.scalars(select(Report).order_by(Report.id.desc()).limit(50)):
                print(f"#{report.id} {report.created_at:%Y-%m-%d %H:%M} /p/{report.slug} [{report.reason}] {report.contact or '-'}")
                if report.details:
                    print(f"    {report.details}")
        return 0

    if len(arguments) == 2 and arguments[0] == "unpublish":
        slug = arguments[1].strip().lower()
        with SessionLocal() as db:
            portfolio = db.scalar(select(Portfolio).where(Portfolio.slug == slug))
            if portfolio is None:
                print(f"No portfolio at /p/{slug}.")
                return 1
            portfolio.published_content = None
            portfolio.published_at = None
            db.commit()
        print(f"/p/{slug} is unpublished.")
        refresh_website(slug)
        return 0

    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
