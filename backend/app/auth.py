"""Registration, email confirmation, Google linking, and account sessions."""

import hashlib
import hmac
import logging
import os
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import case, delete, or_, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth_email import send_verification_code
from app.db import get_db
from app.google_oauth import frontend_origin, google_authorization, google_config, google_identity
from app.models import AuthChallenge, AuthRateLimit, AuthSession, User
from app.schemas import AccountDetails, GoogleIdentity, PasswordLogin, RegisterAccount, SetAccountPassword, VerifyAccountCode

router = APIRouter(prefix="/api/auth", tags=["accounts"])
logger = logging.getLogger(__name__)
Database = Annotated[Session, Depends(get_db)]
CODE_TTL = 600
SESSION_TTL = 7 * 24 * 60 * 60


def now() -> int:
    return int(time.time())


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def code_digest(token_hash: str, code: str) -> str:
    secret = os.getenv("AUTH_CODE_SECRET", "").encode()
    if len(secret) < 32:
        raise HTTPException(503, "Email verification is not configured.")
    return hmac.new(secret, f"{token_hash}:{code}".encode(), hashlib.sha256).hexdigest()


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt if salt is not None else secrets.token_bytes(16)
    value = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2)
    return f"scrypt:{salt.hex()}:{value.hex()}"


def password_matches(password: str, stored: str | None) -> bool:
    # An unknown account still pays the same hashing cost.
    salt = bytes.fromhex(stored.split(":")[1]) if stored else bytes(16)
    candidate = password_hash(password, salt)
    return hmac.compare_digest(candidate, stored or "") and stored is not None


def cookie_secure() -> bool:
    return frontend_origin().startswith("https://")


def cookie_name(name: str) -> str:
    return ("__Host-" if cookie_secure() else "") + f"portfolabs_{name}"


def get_cookie(request: Request, name: str) -> str | None:
    return request.cookies.get(cookie_name(name))


def set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        cookie_name(name), value, max_age=max_age, path="/",
        httponly=True, secure=cookie_secure(), samesite="lax",
    )


def throttle(db: Session, bucket: str, email: str, limit: int, window: int) -> None:
    timestamp = now()
    limits = AuthRateLimit.__table__
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else postgres_insert
    expired = limits.c.expires_at <= timestamp
    allowed = db.execute(
        insert(limits).values(key=digest(f"{bucket}:{email}"), attempts=1, expires_at=timestamp + window)
        .on_conflict_do_update(
            index_elements=[limits.c.key],
            set_={
                "attempts": case((expired, 1), else_=limits.c.attempts + 1),
                "expires_at": case((expired, timestamp + window), else_=limits.c.expires_at),
            },
            where=or_(expired, limits.c.attempts < limit),
        )
        .returning(limits.c.attempts)
    ).scalar_one_or_none()
    if allowed is None:
        raise HTTPException(429, "Too many attempts. Please wait before trying again.")


def throttle_email(db: Session, email: str) -> None:
    throttle(db, "send-minute", email, 1, 60)
    throttle(db, "send-hour", email, 5, 3600)
    db.commit()


def start_challenge(
    db: Session, response: Response, *, email: str, name: str, purpose: str,
    require_code: bool = True, password: str | None = None,
    subject: str | None = None, user_id: int | None = None,
) -> None:
    if require_code:
        throttle_email(db, email)
    token = secrets.token_urlsafe(32)
    token_hash = digest(token)
    code = f"{secrets.randbelow(1_000_000):06d}" if require_code else None
    code_hash = code_digest(token_hash, code) if code is not None else None
    hashed_password = password_hash(password) if password is not None else None
    # A fresh challenge supersedes the previous browser's attempt for the same flow.
    db.execute(delete(AuthChallenge).where(
        AuthChallenge.email == email, AuthChallenge.purpose == purpose,
    ))
    db.add(AuthChallenge(
        token_hash=token_hash, email=email, name=name, purpose=purpose,
        password_hash=hashed_password,
        google_subject=subject, user_id=user_id,
        code_hash=code_hash, attempts_left=5, expires_at=now() + CODE_TTL,
    ))
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Another attempt is in progress. Please try again.") from error

    if code is not None:
        try:
            send_verification_code(email, code, linking=purpose == "google_link")
        except (OSError, KeyError, ValueError) as error:
            db.execute(delete(AuthChallenge).where(AuthChallenge.token_hash == token_hash))
            db.commit()
            logger.warning("Portfolabs verification email failed (%s)", type(error).__name__)
            raise HTTPException(503, "We couldn’t send a verification email. Try again in a minute.") from error
    set_cookie(response, "challenge", token, CODE_TTL)


def create_session(db: Session, request: Request, response: Response, user: User) -> None:
    token = secrets.token_urlsafe(32)
    try:
        db.flush()
        previous = get_cookie(request, "session")
        if previous:
            db.execute(delete(AuthSession).where(AuthSession.token_hash == digest(previous)))
        db.add(AuthSession(token_hash=digest(token), user_id=user.id, expires_at=now() + SESSION_TTL))
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "This account changed during sign-in. Please start again.") from error
    set_cookie(response, "session", token, SESSION_TTL)
    set_cookie(response, "challenge", "", 0)


@router.post("/register")
def register(body: RegisterAccount, response: Response, db: Database):
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        # Return the same next step without sending codes for an existing account.
        throttle_email(db, email)
        set_cookie(response, "challenge", secrets.token_urlsafe(32), CODE_TTL)
        return {"step": "verify"}
    start_challenge(
        db, response, email=email, name=body.name, purpose="register",
        password=body.password,
    )
    return {"step": "verify"}


@router.post("/verify")
def verify(body: VerifyAccountCode, request: Request, response: Response, db: Database):
    token_hash = digest(get_cookie(request, "challenge") or "")
    # Reserve one attempt atomically before reading the challenge. This also
    # serializes successful verification against another request for this code.
    pending = db.scalars(
        update(AuthChallenge)
        .where(
            AuthChallenge.token_hash == token_hash, AuthChallenge.expires_at > now(),
            AuthChallenge.attempts_left > 0, AuthChallenge.code_hash.is_not(None),
        )
        .values(attempts_left=AuthChallenge.attempts_left - 1)
        .returning(AuthChallenge)
    ).one_or_none()
    if pending is None or not hmac.compare_digest(pending.code_hash or "", code_digest(token_hash, body.code)):
        db.commit()
        raise HTTPException(400, "That code is incorrect, expired, or out of attempts. Start again for a new code.")

    if pending.purpose == "google_signup":
        pending.code_hash = None
        pending.expires_at = now() + CODE_TTL
        db.commit()
        set_cookie(response, "challenge", get_cookie(request, "challenge") or "", CODE_TTL)
        return {"step": "password"}

    if pending.purpose == "google_link":
        try:
            user = db.scalars(
                update(User)
                .where(User.id == pending.user_id, User.google_subject.is_(None))
                .values(google_subject=pending.google_subject)
                .returning(User)
            ).one_or_none()
        except IntegrityError as error:
            db.rollback()
            raise HTTPException(409, "This Google sign-in is already linked to an account.") from error
        if user is None:
            raise HTTPException(409, "This account already has a Google sign-in. Start again.")
    else:
        user = User(email=pending.email, name=pending.name, password_hash=pending.password_hash)
        db.add(user)
    db.delete(pending)
    create_session(db, request, response, user)
    return {"step": "signed-in"}


@router.post("/set-password")
def set_password(body: SetAccountPassword, request: Request, response: Response, db: Database):
    token_hash = digest(get_cookie(request, "challenge") or "")
    pending = db.scalars(
        delete(AuthChallenge)
        .where(
            AuthChallenge.token_hash == token_hash, AuthChallenge.expires_at > now(),
            AuthChallenge.purpose == "google_signup", AuthChallenge.code_hash.is_(None),
        )
        .returning(AuthChallenge)
    ).one_or_none()
    if pending is None:
        raise HTTPException(400, "This Google sign-in has expired. Start again.")
    user = User(
        email=pending.email, name=pending.name, google_subject=pending.google_subject,
        password_hash=password_hash(body.password),
    )
    db.add(user)
    create_session(db, request, response, user)
    return {"step": "signed-in"}


@router.post("/login")
def login(body: PasswordLogin, request: Request, response: Response, db: Database):
    email = body.email.lower()
    throttle(db, "password", email, 10, 900)
    db.commit()
    user = db.scalar(select(User).where(User.email == email))
    if not password_matches(body.password, user.password_hash if user else None) or user is None:
        raise HTTPException(401, "Email or password is incorrect.")
    create_session(db, request, response, user)
    return {"step": "signed-in"}


@router.get("/session", response_model=AccountDetails | None)
def session(request: Request, db: Database):
    token = get_cookie(request, "session")
    if not token:
        return None
    return db.scalar(
        select(User).join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token_hash == digest(token), AuthSession.expires_at > now())
    )


@router.post("/logout")
def logout(request: Request, response: Response, db: Database):
    token = get_cookie(request, "session")
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == digest(token)))
        db.commit()
    set_cookie(response, "session", "", 0)
    set_cookie(response, "challenge", "", 0)
    return {"step": "login"}


def complete_google(body: GoogleIdentity, request: Request, response: Response, db: Session) -> str:
    subject = body.subject
    user = db.scalar(select(User).where(User.google_subject == subject))
    if user is not None:
        create_session(db, request, response, user)
        return "signed-in"

    email = body.email.lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        if existing.google_subject is not None:
            raise HTTPException(409, "This account already has a Google sign-in.")
        start_challenge(
            db, response, email=email, name=existing.name, purpose="google_link",
            subject=subject, user_id=existing.id,
        )
        return "link"

    name = body.name.strip() or email.split("@")[0][:120]
    start_challenge(
        db, response, email=email, name=name, purpose="google_signup",
        subject=subject, require_code=not body.authoritative_email,
    )
    return "password" if body.authoritative_email else "verify"


@router.get("/google/start")
def google_start(request: Request):
    try:
        config = google_config()
    except HTTPException:
        return RedirectResponse("/auth?error=google-config", status_code=303)
    if request.headers.get("X-Portfolabs-Origin") != config.origin:
        return RedirectResponse(f"{config.origin}/api/auth/google/start", status_code=303)

    url, state_cookie = google_authorization(config)
    response = RedirectResponse(url, status_code=303)
    set_cookie(response, "oauth", state_cookie, CODE_TTL)
    return response


@router.get("/google/callback")
def google_callback(request: Request, db: Database, code: str = "", state: str = ""):
    response = RedirectResponse("/auth?error=google", status_code=303)
    set_cookie(response, "oauth", "", 0)
    cookie = (get_cookie(request, "oauth") or "").split(".")
    if len(cookie) != 3 or not code or not state.isascii() or not hmac.compare_digest(cookie[0], state):
        return response

    try:
        identity = google_identity(google_config(), code, cookie[1], cookie[2])
        step = complete_google(identity, request, response, db)
        response.headers["location"] = "/auth" if step == "signed-in" else f"/auth?step={step}"
    except (HTTPException, IntegrityError) as error:
        db.rollback()
        if isinstance(error, HTTPException) and error.status_code in (429, 503):
            response.headers["location"] = "/auth?error=email"
    return response
