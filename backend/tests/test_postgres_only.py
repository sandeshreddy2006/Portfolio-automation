"""Checks that only mean something on PostgreSQL, the database the live site uses.

They are skipped unless TEST_DATABASE_URL points at an empty PostgreSQL database (see conftest.py).
SQLite runs one write at a time, so it can't show whether the limits survive real simultaneous requests.
"""

import os
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, make_url, text

from app.main import app
from app.migrate import migrate_schema
from conftest import content, login_as, make_user

POSTGRES_URL = os.environ.get("TEST_DATABASE_URL", "")
pytestmark = pytest.mark.skipif(not POSTGRES_URL.startswith("postgres"), reason="needs PostgreSQL (TEST_DATABASE_URL)")


def same_session(owner: TestClient) -> TestClient:
    """Another browser tab: a separate client holding the same sign-in cookie."""
    tab = TestClient(app)
    tab.cookies.set("portfolabs_session", owner.cookies.get("portfolabs_session"))
    return tab


def test_the_limit_of_five_holds_when_requests_arrive_at_the_same_moment(client):
    owner = login_as(make_user())
    tabs = [same_session(owner) for _ in range(12)]

    def create(index):
        return tabs[index].post("/api/portfolios", json={"slug": f"race-{index}", "draft_content": content()}).status_code

    with ThreadPoolExecutor(max_workers=12) as pool:
        codes = list(pool.map(create, range(12)))
    assert codes.count(201) == 5, codes  # never 6, however the requests interleave
    assert len(owner.get("/api/portfolios").json()) == 5


def test_two_saves_from_the_same_revision_can_not_both_win(client):
    owner = login_as(make_user())
    owner.post("/api/portfolios", json={"slug": "contested", "draft_content": content()})
    revision = owner.get("/api/portfolios/contested").json()["revision"]
    tabs = [same_session(owner) for _ in range(8)]

    def save(index):
        body = {"draft_content": content(name=f"Writer {index}"), "base_revision": revision}
        return tabs[index].put("/api/portfolios/contested", json=body).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        codes = list(pool.map(save, range(8)))
    assert codes.count(200) == 1 and codes.count(409) == 7, codes
    assert owner.get("/api/portfolios/contested").json()["revision"] == revision + 1


def test_the_live_sites_older_database_upgrades_without_losing_anything():
    """The shape before owners, revisions, images and reports existed, with a real row in it."""
    base = make_url(POSTGRES_URL.replace("postgresql://", "postgresql+psycopg://", 1))
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text("DROP DATABASE IF EXISTS migrate_probe"))
        connection.execute(text("CREATE DATABASE migrate_probe"))
    target = create_engine(base.set(database="migrate_probe"))
    try:
        with target.begin() as connection:
            connection.execute(text(
                "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, "
                "password_hash VARCHAR(255) NOT NULL, google_subject VARCHAR(255) UNIQUE, created_at TIMESTAMPTZ DEFAULT now())"
            ))
            connection.execute(text(
                "CREATE TABLE portfolios (id SERIAL PRIMARY KEY, slug VARCHAR(64) NOT NULL UNIQUE, draft_content JSONB NOT NULL, "
                "published_content JSONB, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())"
            ))
            connection.execute(text("INSERT INTO users (name, email, password_hash) VALUES ('Old User', 'old@example.com', 'x')"))
            connection.execute(text(
                """INSERT INTO portfolios (slug, draft_content) VALUES ('old-one', '{"template_id": "editorial", "name": "Old"}')"""
            ))

        for deployment in ("deploy-1", "deploy-1", "deploy-2"):  # a redeploy must be harmless
            migrate_schema(target, deployment)

        inspector = inspect(target)
        columns = {column["name"] for column in inspector.get_columns("portfolios")}
        assert {"owner_id", "revision"} <= columns
        assert {"uploads", "reports", "slug_holds", "auth_sessions", "auth_challenges"} <= set(inspector.get_table_names())
        assert "redirect_to" in {column["name"] for column in inspector.get_columns("slug_holds")}
        assert any(key["referred_table"] == "users" for key in inspector.get_foreign_keys("portfolios"))
        with target.connect() as connection:
            assert connection.execute(text("SELECT slug FROM portfolios")).scalar() == "old-one"  # nothing was lost
            assert connection.execute(text("SELECT email FROM users")).scalar() == "old@example.com"
    finally:
        target.dispose()
        with admin.connect() as connection:
            connection.execute(text("DROP DATABASE IF EXISTS migrate_probe"))
        admin.dispose()
