import re
import time
from pathlib import Path

import moderate
from app import slugs
from app.db import SessionLocal
from app.models import Portfolio, SlugHold
from app.portfolios import TEMPLATE_IDS
from conftest import content, login_as, make_user
from sqlalchemy import select

FRONTEND_META = Path(__file__).resolve().parents[2] / "frontend" / "components" / "templates" / "meta.ts"


def create(owner, slug):
    return owner.post("/api/portfolios", json={"slug": slug, "draft_content": content()})


def test_template_lists_match_between_frontend_and_backend():
    """meta.ts and TEMPLATE_IDS must name the same templates or users hit confusing errors."""
    frontend_ids = set(re.findall(r'^\s*id:\s*"([a-z0-9-]+)"', FRONTEND_META.read_text(encoding="utf-8"), re.M))
    assert frontend_ids and frontend_ids == TEMPLATE_IDS


def test_a_deleted_address_is_held_for_its_old_owner(client):
    alex = login_as(make_user())
    sam = login_as(make_user("sam@example.com"))
    create(alex, "alex-site")
    alex.delete("/api/portfolios/alex-site")

    assert create(sam, "alex-site").status_code == 409  # someone else can't take it over
    assert create(alex, "alex-site").status_code == 201  # the old owner can have it back


def test_the_hold_expires(client):
    alex = login_as(make_user())
    sam = login_as(make_user("sam@example.com"))
    create(alex, "alex-site")
    alex.delete("/api/portfolios/alex-site")
    with SessionLocal() as db:
        db.get(SlugHold, "alex-site").until = int(time.time()) - 1
        db.commit()
    assert create(sam, "alex-site").status_code == 201


def test_a_deleted_account_holds_its_addresses_for_everyone(client):
    user = make_user()
    owner = login_as(user)
    create(owner, "gone-soon")
    with SessionLocal() as db:
        slugs.hold_user_slugs(db, user.id)
        db.commit()
        assert db.scalars(select(SlugHold.owner_id)).all() == [None]
    # Even the same person signing up again can't instantly reuse it.
    again = login_as(make_user("alex2@example.com"))
    owner.delete("/api/portfolios/gone-soon")
    assert create(again, "gone-soon").status_code == 409


def test_moderation_tool_unpublishes_a_portfolio(client, capsys, monkeypatch):
    monkeypatch.delenv("REVALIDATE_SECRET", raising=False)
    owner = login_as(make_user())
    create(owner, "bad-site")
    owner.post("/api/portfolios/bad-site/publish")
    assert client.get("/api/public/bad-site").status_code == 200

    assert moderate.main(["unpublish", "bad-site"]) == 0
    assert client.get("/api/public/bad-site").status_code == 404
    assert "cached page can stay visible" in capsys.readouterr().out  # warns when the website can't be refreshed
    with SessionLocal() as db:
        assert db.scalar(select(Portfolio.slug).where(Portfolio.slug == "bad-site")) == "bad-site"  # kept, not deleted
    assert moderate.main(["unpublish", "no-such-site"]) == 1


def test_moderation_tool_lists_reports(client, capsys):
    owner = login_as(make_user())
    create(owner, "reported")
    owner.post("/api/portfolios/reported/publish")
    client.post("/api/public/reported/report", json={"reason": "spam", "details": "looks fake"})
    assert moderate.main(["reports"]) == 0
    output = capsys.readouterr().out
    assert "/p/reported [spam]" in output and "looks fake" in output
