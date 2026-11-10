import os
import secrets
import tempfile
from pathlib import Path

# Must be set before app.db is imported so tests never touch a real database.
_directory = tempfile.mkdtemp(prefix="portfolio-tests-")
# Set TEST_DATABASE_URL (an empty PostgreSQL database) to run the whole suite against PostgreSQL,
# which is what the live site uses. Everything in it gets wiped between tests.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{Path(_directory, 'test.db').as_posix()}"
os.environ["FRONTEND_URL"] = "http://localhost:3000"
os.environ["AUTH_CODE_SECRET"] = "x" * 40

import pytest
from fastapi.testclient import TestClient

from app.auth import digest, now
from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import AuthSession, User


@pytest.fixture(autouse=True)
def no_dns_lookups(monkeypatch):
    monkeypatch.setattr("app.auth.verify_email_domain", lambda email: None)


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def make_user(email: str = "alex@example.com") -> User:
    with SessionLocal() as db:
        user = User(name="Alex", email=email, password_hash="not-a-real-hash")
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def login_as(user: User) -> TestClient:
    """A separate client holding a valid session cookie for this user."""
    token = secrets.token_urlsafe(32)
    with SessionLocal() as db:
        db.add(AuthSession(token_hash=digest(token), user_id=user.id, expires_at=now() + 3600))
        db.commit()
    signed_in = TestClient(app)
    signed_in.cookies.set("portfolabs_session", token)
    return signed_in


def content(template_id: str = "editorial", name: str = "Alex Morgan", **extra) -> dict:
    return {
        "template_id": template_id, "name": name, "headline": "Designer", "bio": "Hello",
        "projects": [{"title": "Tidepool", "description": "A habit tracker", "url": "https://example.com"}],
        "links": [{"label": "GitHub", "url": "https://github.com/example"}],
        **extra,
    }
