"""Sign-up, email verification, password sign-in and Google sign-in."""

from urllib.parse import parse_qs, urlparse

import pytest
from email_validator import EmailUndeliverableError
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import auth, emailcheck
from app.db import SessionLocal
from app.main import app
from app.models import AuthChallenge, AuthRateLimit, User
from app.schemas import GoogleIdentity

PASSWORD = "Str0ng-Passw0rd!"
ORIGIN = {"X-Portfolabs-Origin": "http://localhost:3000"}


@pytest.fixture
def sent(monkeypatch):
    """Every verification email the app tries to send, as (address, code, purpose)."""
    messages = []
    monkeypatch.setattr(auth, "send_verification_code", lambda email, code, purpose: messages.append((email, code, purpose)))
    monkeypatch.setattr(auth, "send_account_notice", lambda *args, **kwargs: None)
    return messages


def register(client, email="new@example.com", password=PASSWORD, name="New Person"):
    return client.post("/api/auth/register", json={"name": name, "email": email, "password": password})


def skip_cooldown():
    """Pretend 30 seconds passed, so the one-code-per-email cooldown does not get in the way."""
    with SessionLocal() as db:
        for row in db.scalars(select(AuthRateLimit)):
            db.delete(row)
        db.commit()


def signed_up(client, sent, email="new@example.com"):
    register(client, email)
    assert client.post("/api/auth/verify", json={"code": sent[-1][1]}).json() == {"step": "signed-in"}


# ---- email + password sign-up


def test_full_signup_then_sign_in_and_out(client, sent):
    assert register(client).json() == {"step": "verify"}
    assert len(sent) == 1 and sent[0][0] == "new@example.com" and len(sent[0][1]) == 6

    wrong = "000000" if sent[0][1] != "000000" else "111111"
    assert client.post("/api/auth/verify", json={"code": wrong}).status_code == 400
    assert client.post("/api/auth/verify", json={"code": sent[0][1]}).json() == {"step": "signed-in"}

    account = client.get("/api/auth/session").json()
    assert account["email"] == "new@example.com" and account["name"] == "New Person" and account["google_connected"] is False
    with SessionLocal() as db:
        user = db.scalar(select(User))
        assert user.password_hash.startswith("scrypt:") and PASSWORD not in user.password_hash  # never stored readable

    assert client.post("/api/auth/logout").json() == {"step": "login"}
    assert client.get("/api/auth/session").json() is None

    other_browser = TestClient(app)
    assert other_browser.post("/api/auth/login", json={"email": "NEW@example.com", "password": PASSWORD}).json() == {"step": "signed-in"}
    assert other_browser.get("/api/auth/session").json()["email"] == "new@example.com"


def test_wrong_password_and_unknown_email_look_identical(client, sent):
    signed_up(client, sent)
    wrong = TestClient(app).post("/api/auth/login", json={"email": "new@example.com", "password": "not-the-password"})
    unknown = TestClient(app).post("/api/auth/login", json={"email": "nobody@example.com", "password": "not-the-password"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()  # nobody can discover which emails have accounts


def test_registering_an_existing_email_sends_nothing_and_reveals_nothing(client, sent):
    signed_up(client, sent)
    before = len(sent)
    skip_cooldown()
    again = register(TestClient(app))
    assert again.status_code == 200 and again.json() == {"step": "verify"}
    assert len(sent) == before  # no code, so the real owner isn't spammed


def test_a_code_stops_working_after_five_wrong_guesses(client, sent):
    register(client)
    wrong = "000000" if sent[0][1] != "000000" else "111111"
    assert [client.post("/api/auth/verify", json={"code": wrong}).status_code for _ in range(5)] == [400] * 5
    assert client.post("/api/auth/verify", json={"code": sent[0][1]}).status_code == 400  # even the right one is now refused


def test_the_code_only_works_in_the_browser_that_asked_for_it(client, sent):
    register(client)
    assert TestClient(app).post("/api/auth/verify", json={"code": sent[0][1]}).status_code == 400


def test_codes_can_not_be_requested_over_and_over(client, sent):
    register(client)
    assert client.post("/api/auth/verification/resend").status_code == 429  # 30 second cooldown
    assert len(sent) == 1


@pytest.mark.parametrize("payload", [
    {"name": "A", "email": "a@example.com", "password": "short"},
    {"name": "A", "email": "not-an-email", "password": PASSWORD},
    {"name": "", "email": "a@example.com", "password": PASSWORD},
])
def test_bad_sign_up_details_are_rejected(client, sent, payload):
    assert client.post("/api/auth/register", json=payload).status_code == 422
    assert sent == []


def test_password_sign_in_is_rate_limited(client, sent):
    signed_up(client, sent)
    codes = [TestClient(app).post("/api/auth/login", json={"email": "new@example.com", "password": "guess"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


# ---- is it a real inbox?


def test_throwaway_inbox_addresses_are_refused_before_any_code_is_sent(client, sent, monkeypatch):
    monkeypatch.setattr(auth, "verify_email_domain", emailcheck.verify_email_domain)
    for address in ("someone@mailinator.com", "someone@sub.yopmail.com", "SOMEONE@Guerrillamail.COM"):
        response = register(client, address)
        assert response.status_code == 422 and "permanent email" in response.json()["detail"]
    assert sent == []
    with SessionLocal() as db:
        assert db.scalars(select(AuthChallenge)).all() == []


def test_domains_that_cannot_receive_mail_are_refused(client, sent, monkeypatch):
    def undeliverable(email, **kwargs):
        raise EmailUndeliverableError("The domain name nope.invalid does not exist.")

    monkeypatch.setattr(auth, "verify_email_domain", emailcheck.verify_email_domain)
    monkeypatch.setattr(emailcheck, "validate_email", undeliverable)
    response = register(client, "typo@nonexistent-domain-xyz.com")
    assert response.status_code == 422 and "couldn’t verify that email" in response.json()["detail"]
    assert sent == []


def test_a_real_looking_domain_goes_through(client, sent, monkeypatch):
    monkeypatch.setattr(auth, "verify_email_domain", emailcheck.verify_email_domain)
    checked = []
    monkeypatch.setattr(emailcheck, "validate_email", lambda email, **kwargs: checked.append(kwargs["check_deliverability"]))
    assert register(client, "real@gmail.com").json() == {"step": "verify"}
    assert checked == [True] and len(sent) == 1


# ---- Google sign-in


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")
    identity = {"value": GoogleIdentity(subject="google-sub-1", email="gina@example.com", name="Gina Google")}
    monkeypatch.setattr(auth, "google_identity", lambda config, code, verifier, nonce: identity["value"])
    return identity


def google_callback(client, state=None, code="auth-code"):
    start = client.get("/api/auth/google/start", headers=ORIGIN, follow_redirects=False)
    assert start.status_code == 303
    query = parse_qs(urlparse(start.headers["location"]).query)
    return start, client.get(f"/api/auth/google/callback?code={code}&state={state or query['state'][0]}", follow_redirects=False)


def test_google_start_sends_people_to_google_with_pkce(client, google):
    start, _ = google_callback(client)
    target = urlparse(start.headers["location"])
    query = parse_qs(target.query)
    assert target.netloc == "accounts.google.com"
    assert query["client_id"] == ["test-client-id.apps.googleusercontent.com"]
    assert query["code_challenge_method"] == ["S256"] and query["state"] and query["nonce"]
    assert query["redirect_uri"] == ["http://localhost:3000/api/auth/google/callback"]


def test_google_is_reported_unconfigured_instead_of_crashing(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    response = client.get("/api/auth/google/start", headers=ORIGIN, follow_redirects=False)
    assert response.status_code == 303 and "error=google-config" in response.headers["location"]


def test_a_forged_google_callback_is_rejected(client, google):
    _, callback = google_callback(client, state="forged-state")
    assert callback.status_code == 303 and "error=google" in callback.headers["location"]
    assert client.get("/api/auth/session").json() is None
    # no oauth cookie at all (someone sending a link to a victim's browser)
    assert TestClient(app).get("/api/auth/google/callback?code=x&state=y", follow_redirects=False).headers["location"].endswith("/auth?error=google")


def test_new_google_user_must_still_verify_their_email_and_set_a_password(client, google, sent):
    _, callback = google_callback(client)
    assert callback.headers["location"].endswith("/auth?step=password")
    assert client.post("/api/auth/set-password", json={"password": PASSWORD}).json() == {"step": "verify"}
    assert sent[-1][0] == "gina@example.com"
    assert client.post("/api/auth/verify", json={"code": sent[-1][1]}).json() == {"step": "signed-in"}
    account = client.get("/api/auth/session").json()
    assert account["email"] == "gina@example.com" and account["google_connected"] is True


def test_returning_google_user_goes_straight_to_the_dashboard(client, google, sent):
    google_callback(client)
    client.post("/api/auth/set-password", json={"password": PASSWORD})
    client.post("/api/auth/verify", json={"code": sent[-1][1]})

    returning = TestClient(app)
    _, callback = google_callback(returning)
    assert callback.headers["location"] == "/dashboard"
    assert returning.get("/api/auth/session").json()["email"] == "gina@example.com"


def test_google_with_an_existing_email_account_needs_an_email_code_to_link(client, google, sent):
    signed_up(client, sent, "gina@example.com")  # account made earlier with a password
    sent.clear()
    skip_cooldown()

    browser = TestClient(app)
    _, callback = google_callback(browser)
    assert callback.headers["location"].endswith("/auth?step=link")  # NOT signed in just because Google says so
    assert browser.get("/api/auth/session").json() is None
    assert sent[-1][0] == "gina@example.com" and sent[-1][2] == "link"
    assert browser.post("/api/auth/verify", json={"code": sent[-1][1]}).json() == {"step": "signed-in"}
    assert browser.get("/api/auth/session").json()["google_connected"] is True
