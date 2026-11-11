"""Create a local test account and a published demo portfolio.

Local development only. It refuses to run against PostgreSQL (your live
database) so a known password can never end up on production.

    .venv\\Scripts\\python.exe seed_dev.py
"""

import sys
from datetime import datetime, timezone

from sqlalchemy import select

from app.auth import password_hash
from app.db import SessionLocal, engine
from app.migrate import migrate_schema
from app.models import Portfolio, User

EMAIL = "tester@portfolabs.dev"
PASSWORD = "Portfolabs-Test-2026!"
SLUG = "demo-alex"

DEMO = {
    "template_id": "editorial",
    "name": "Alex Morgan",
    "headline": "Product designer & front-end developer",
    "bio": "I design and build small, careful interfaces for people who are tired of clutter.\n\nMost of what I've learned came from shipping something and watching someone get confused by it.",
    "projects": [
        {"title": "Tidepool", "description": "A habit tracker that rewards consistency instead of streaks.", "url": "https://example.com/tidepool"},
        {"title": "Field Notes", "description": "An offline-first notes app for researchers.", "url": "https://example.com/field-notes"},
    ],
    "links": [{"label": "GitHub", "url": "https://github.com/example"}],
}


def main() -> None:
    if engine.dialect.name != "sqlite":
        sys.exit("Refusing to seed a non-SQLite database. This script is for local testing only.")

    migrate_schema(engine)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == EMAIL))
        if user is None:
            user = User(name="Test Admin", email=EMAIL, password_hash=password_hash(PASSWORD))
            db.add(user)
            db.flush()
        else:
            user.password_hash = password_hash(PASSWORD)

        demo = db.scalar(select(Portfolio).where(Portfolio.slug == SLUG))
        if demo is None:
            demo = Portfolio(owner_id=user.id, slug=SLUG)
            db.add(demo)
        # Running the script again puts the demo back to its original content.
        demo.owner_id = user.id
        demo.draft_content = dict(DEMO)
        demo.published_content = dict(DEMO)
        demo.published_at = datetime.now(timezone.utc)
        db.commit()

    print(f"Test account ready.\n  Email:    {EMAIL}\n  Password: {PASSWORD}\n  Demo portfolio: /p/{SLUG}")


if __name__ == "__main__":
    main()
