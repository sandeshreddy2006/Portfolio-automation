"""Registration, email confirmation, Google linking, and account sessions."""

import hashlib
import hmac
import logging
import os
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import case, delete, or_, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth_email import send_account_notice, send_verification_code
from app.emailcheck import verify_email_domain
from app.db import get_db
from app.google_oauth import frontend_origin, google_authorization, google_config, google_identity
from app.media import lock_portfolio_media, purge_user_media
from app.domains import cleanup_orphan_domains
from app.slugs import release_user_slugs
from app.models import AuthChallenge, AuthRateLimit, AuthSession, User
from app.schemas import AccountDetails, GoogleIdentity, PasswordChangeRequest, PasswordLogin, PasswordResetRequest, PasswordUpdate, RegisterAccount, SetAccountPassword, VerifyAccountCode

router = APIRouter(prefix="/api/auth", tags=["accounts"])
logger = logging.getLogger(__name__)
Database = Annotated[Session, Depends(get_db)]
CODE_TTL = 600
RESEND_COOLDOWN = 30
EMAIL_LIMITS = (("send-cooldown", 1, RESEND_COOLDOWN), ("send-hour", 5, 3600))
VERIFICATION_PURPOSES = ("register", "google_signup", "google_confirm", "google_link")
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
    key = digest(f"{bucket}:{email}")
    allowed = db.execute(
        insert(limits).values(key=key, attempts=1, expires_at=timestamp + window)
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
        expires_at = db.scalar(select(limits.c.expires_at).where(limits.c.key == key))
        raise HTTPException(
            429, "Too many attempts. Please wait before trying again.",
            headers={"Retry-After": str(max(1, (expires_at or timestamp) - timestamp))},
        )


def throttle_email(db: Session, email: str) -> None:
    for bucket, limit, window in EMAIL_LIMITS:
        throttle(db, bucket, email, limit, window)
    db.commit()


def email_retry_after(db: Session, email: str) -> int:
    timestamp = now()
    limits = {digest(f"{bucket}:{email}"): limit for bucket, limit, _ in EMAIL_LIMITS}
    rows = db.scalars(select(AuthRateLimit).where(AuthRateLimit.key.in_(list(limits))))
    return max(0, max((row.expires_at - timestamp for row in rows if row.attempts >= limits[row.key]), default=0))


def deliver_challenge(email: str, code: str, purpose: str) -> None:
    email_purpose = {"google_link": "link", "delete": "delete", "password_reset": "reset", "password_change": "change"}.get(purpose, "verify")
    try:
        send_verification_code(email, code, purpose=email_purpose)
    except (OSError, KeyError, ValueError) as error:
        logger.warning("Portfolabs verification email failed (%s)", type(error).__name__)
        raise HTTPException(
            503, "We couldn’t send a verification email. Please try again.",
            headers={"Retry-After": str(RESEND_COOLDOWN)},
        ) from error


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
            deliver_challenge(email, code, purpose)
        except HTTPException:
            db.execute(delete(AuthChallenge).where(AuthChallenge.token_hash == token_hash))
            db.commit()
            raise
    set_cookie(response, "challenge", token, CODE_TTL)


def create_session(
    db: Session, request: Request, response: Response, user: User, background: BackgroundTasks,
) -> None:
    token = secrets.token_urlsafe(32)
    email = user.email
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
    background.add_task(send_account_notice, email)


@router.post("/register")
def register(body: RegisterAccount, response: Response, db: Database):
    email = body.email.lower()
    verify_email_domain(email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        # Return the same next step without sending codes for an existing account.
        throttle_email(db, email)
        start_challenge(
            db, response, email=email, name="", purpose="register_placeholder", require_code=False,
        )
        return {"step": "verify"}
    start_challenge(
        db, response, email=email, name=body.name, purpose="register",
        password=body.password,
    )
    return {"step": "verify"}


def verified_challenge(
    db: Session, request: Request, code: str, purposes: tuple[str, ...], user_id: int | None = None,
) -> AuthChallenge:
    token_hash = digest(get_cookie(request, "challenge") or "")
    # Reserve one attempt atomically before reading the challenge. This also
    # serializes successful verification against another request for this code.
    claim = (
        update(AuthChallenge)
        .where(
            AuthChallenge.token_hash == token_hash, AuthChallenge.expires_at > now(),
            AuthChallenge.attempts_left > 0, AuthChallenge.code_hash.is_not(None),
            AuthChallenge.purpose.in_(purposes),
        )
    )
    if user_id is not None:
        claim = claim.where(AuthChallenge.user_id == user_id)
    pending = db.scalars(
        claim.values(attempts_left=AuthChallenge.attempts_left - 1).returning(AuthChallenge)
    ).one_or_none()
    if pending is None or not hmac.compare_digest(pending.code_hash or "", code_digest(token_hash, code)):
        db.commit()
        raise HTTPException(400, "That code is incorrect, expired, or out of attempts. Start again for a new code.")
    return pending


@router.post("/verify")
def verify(body: VerifyAccountCode, request: Request, response: Response, db: Database, background: BackgroundTasks):
    pending = verified_challenge(db, request, body.code, VERIFICATION_PURPOSES)

    # Allow pre-update Google challenges that already received their first code to finish.
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
        user = User(
            email=pending.email, name=pending.name, password_hash=pending.password_hash,
            google_subject=pending.google_subject,
        )
        db.add(user)
        if pending.purpose == "google_confirm":
            db.execute(delete(AuthChallenge).where(
                AuthChallenge.email == pending.email, AuthChallenge.purpose == "google_signup",
            ))
    db.delete(pending)
    create_session(db, request, response, user, background)
    return {"step": "signed-in"}


@router.post("/set-password")
def set_password(body: SetAccountPassword, request: Request, response: Response, db: Database):
    token_hash = digest(get_cookie(request, "challenge") or "")
    pending = db.scalars(
        select(AuthChallenge)
        .where(
            AuthChallenge.token_hash == token_hash, AuthChallenge.expires_at > now(),
            AuthChallenge.purpose == "google_signup", AuthChallenge.code_hash.is_(None),
        )
    ).one_or_none()
    if pending is None:
        raise HTTPException(400, "This Google sign-in has expired. Start again.")
    if db.scalar(select(User.id).where(User.email == pending.email)) is not None:
        raise HTTPException(409, "This email already has an account. Start again to sign in.")
    start_challenge(
        db, response, email=pending.email, name=pending.name, purpose="google_confirm",
        password=body.password, subject=pending.google_subject,
    )
    return {"step": "verify"}


@router.post("/login")
def login(body: PasswordLogin, request: Request, response: Response, db: Database, background: BackgroundTasks):
    email = body.email.lower()
    throttle(db, "password", email, 10, 900)
    db.commit()
    user = db.scalar(select(User).where(User.email == email))
    if not password_matches(body.password, user.password_hash if user else None) or user is None:
        raise HTTPException(401, "Email or password is incorrect.")
    create_session(db, request, response, user, background)
    return {"step": "signed-in"}


def current_user(request: Request, db: Session) -> User | None:
    token = get_cookie(request, "session")
    if not token:
        return None
    return db.scalar(
        select(User).join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token_hash == digest(token), AuthSession.expires_at > now())
    )


@router.get("/session", response_model=AccountDetails | None)
def session(request: Request, db: Database):
    return current_user(request, db)


def pending_verification(request: Request, db: Session) -> AuthChallenge:
    token = get_cookie(request, "challenge")
    pending = db.get(AuthChallenge, digest(token)) if token else None
    if pending is None or pending.expires_at <= now() or (
        pending.code_hash is None and pending.purpose not in ("register_placeholder", "reset_placeholder")
    ):
        raise HTTPException(400, "This verification has expired. Start again for a new code.")
    if pending.purpose in ("delete", "password_change"):
        user = current_user(request, db)
        if user is None or user.id != pending.user_id:
            raise HTTPException(401, "Sign in to manage your account.")
    return pending


@router.get("/verification")
def verification_status(request: Request, db: Database):
    pending = pending_verification(request, db)
    return {"retry_after": email_retry_after(db, pending.email)}


@router.post("/verification/resend")
def resend_verification(request: Request, response: Response, db: Database):
    pending = pending_verification(request, db)
    email, purpose, token_hash, previous_code_hash = (
        pending.email, pending.purpose, pending.token_hash, pending.code_hash
    )
    throttle_email(db, email)

    code, code_hash = None, None
    if purpose not in ("register_placeholder", "reset_placeholder"):
        code = f"{secrets.randbelow(1_000_000):06d}"
        code_hash = code_digest(token_hash, code)
        while code_hash == previous_code_hash:
            code = f"{secrets.randbelow(1_000_000):06d}"
            code_hash = code_digest(token_hash, code)

    refreshed = db.scalar(
        update(AuthChallenge)
        .where(
            AuthChallenge.token_hash == token_hash,
            AuthChallenge.code_hash == previous_code_hash,
            AuthChallenge.expires_at > now(),
        )
        .values(code_hash=code_hash, attempts_left=5, expires_at=now() + CODE_TTL)
        .returning(AuthChallenge.token_hash)
    )
    if refreshed is None:
        raise HTTPException(400, "This verification has expired. Start again for a new code.")

    # If delivery fails, roll back the replacement so the original code still works.
    if code is not None:
        try:
            deliver_challenge(email, code, purpose)
        except HTTPException:
            db.rollback()
            raise
    db.commit()
    set_cookie(response, "challenge", get_cookie(request, "challenge") or "", CODE_TTL)
    return {"retry_after": email_retry_after(db, email)}


@router.post("/password/reset/start")
def start_password_reset(body: PasswordResetRequest, response: Response, db: Database):
    email = body.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        throttle_email(db, email)
        start_challenge(db, response, email=email, name="", purpose="reset_placeholder", require_code=False)
    else:
        try:
            start_challenge(db, response, email=email, name=user.name, purpose="password_reset", user_id=user.id)
        except HTTPException as error:
            if error.status_code != 503:
                raise
            # Give the same response for unavailable delivery and unknown addresses.
            start_challenge(db, response, email=email, name="", purpose="reset_placeholder", require_code=False)
    return {"step": "reset-confirm"}


@router.post("/password/change/start")
def start_password_change(body: PasswordChangeRequest, request: Request, response: Response, db: Database):
    user = current_user(request, db)
    if user is None:
        raise HTTPException(401, "Sign in to change your password.")
    throttle(db, "password-change", str(user.id), 10, 3600)
    db.commit()
    if not password_matches(body.current_password, user.password_hash):
        raise HTTPException(400, "Your current password is incorrect.")
    start_challenge(db, response, email=user.email, name=user.name, purpose="password_change", user_id=user.id)
    return {"step": "change-confirm"}


def update_account_password(body: PasswordUpdate, request: Request, response: Response, db: Session, purpose: str):
    user = current_user(request, db) if purpose == "password_change" else None
    if purpose == "password_change" and user is None:
        raise HTTPException(401, "Sign in to change your password.")
    token = get_cookie(request, "challenge") or ""
    challenge = db.get(AuthChallenge, digest(token))
    if challenge is None or challenge.user_id is None:
        verified_challenge(db, request, body.code, (purpose,))
        raise HTTPException(400, "Start again for a new code.")
    user_id = user.id if user else challenge.user_id
    lock_portfolio_media(db, user_id)
    pending = verified_challenge(db, request, body.code, (purpose,), user_id)
    updated = db.execute(update(User).where(User.id == user_id, User.email == pending.email)
                         .values(password_hash=password_hash(body.password)))
    if not updated.rowcount:
        raise HTTPException(400, "Start again for a new code.")
    db.execute(delete(AuthChallenge).where(AuthChallenge.user_id == user_id,
               AuthChallenge.purpose.in_(("password_reset", "password_change"))))
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))
    db.commit()
    for name in ("session", "challenge", "oauth"):
        set_cookie(response, name, "", 0)
    return {"step": "password-updated"}


@router.post("/password/reset/confirm")
def confirm_password_reset(body: PasswordUpdate, request: Request, response: Response, db: Database):
    return update_account_password(body, request, response, db, "password_reset")


@router.post("/password/change/confirm")
def confirm_password_change(body: PasswordUpdate, request: Request, response: Response, db: Database):
    return update_account_password(body, request, response, db, "password_change")


@router.post("/delete/start")
def start_account_deletion(request: Request, response: Response, db: Database):
    user = current_user(request, db)
    if user is None:
        raise HTTPException(401, "Sign in to delete your account.")
    start_challenge(
        db, response, email=user.email, name=user.name, purpose="delete", user_id=user.id,
    )
    return {"step": "delete-confirm"}


@router.post("/delete/confirm")
def confirm_account_deletion(
    body: VerifyAccountCode, request: Request, response: Response, db: Database, background: BackgroundTasks,
):
    user = current_user(request, db)
    if user is None:
        raise HTTPException(401, "Sign in to delete your account.")
    lock_portfolio_media(db, user.id)
    verified_challenge(db, request, body.code, ("delete",), user.id)
    email = user.email
    db.execute(delete(AuthChallenge).where(or_(AuthChallenge.email == email, AuthChallenge.user_id == user.id)))
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    purge_user_media(db, user.id)
    release_user_slugs(db, user.id)
    db.delete(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Your account changed during deletion. Please try again.") from error
    for name in ("session", "challenge", "oauth"):
        set_cookie(response, name, "", 0)
    background.add_task(cleanup_orphan_domains)
    background.add_task(send_account_notice, email, deleted=True)
    return {"step": "deleted"}


@router.post("/logout")
def logout(request: Request, response: Response, db: Database):
    token = get_cookie(request, "session")
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == digest(token)))
        db.commit()
    set_cookie(response, "session", "", 0)
    set_cookie(response, "challenge", "", 0)
    return {"step": "login"}


def complete_google(
    body: GoogleIdentity, request: Request, response: Response, db: Session,
    background: BackgroundTasks, link_user: User | None,
) -> str:
    subject = body.subject
    email = body.email.lower()
    user = db.scalar(select(User).where(User.google_subject == subject))
    if link_user is not None and (link_user.email != email or (user is not None and user.id != link_user.id)):
        return "link-mismatch"
    if user is not None:
        create_session(db, request, response, user, background)
        return "signed-in"

    existing = link_user or db.scalar(select(User).where(User.email == email))
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
        subject=subject, require_code=False,
    )
    return "password"


@router.get("/google/start")
def google_start(request: Request, db: Database, intent: str = ""):
    try:
        config = google_config()
    except HTTPException:
        return RedirectResponse("/auth?error=google-config", status_code=303)
    if request.headers.get("X-Portfolabs-Origin") != config.origin:
        query = "?intent=link" if intent == "link" else ""
        return RedirectResponse(f"{config.origin}/api/auth/google/start{query}", status_code=303)

    session_token = get_cookie(request, "session")
    if intent == "link":
        user = current_user(request, db)
        if user is None or not session_token:
            return RedirectResponse("/auth?error=link-sign-in", status_code=303)
        if user.google_connected:
            return RedirectResponse("/auth", status_code=303)
    url, state_cookie = google_authorization(config)
    if intent == "link" and session_token:
        state_cookie += f".{digest(session_token)}"
    response = RedirectResponse(url, status_code=303)
    set_cookie(response, "oauth", state_cookie, CODE_TTL)
    return response


@router.get("/google/callback")
def google_callback(request: Request, db: Database, background: BackgroundTasks, code: str = "", state: str = ""):
    response = RedirectResponse("/auth?error=google", status_code=303)
    set_cookie(response, "oauth", "", 0)
    cookie = (get_cookie(request, "oauth") or "").split(".")
    if len(cookie) not in (3, 4) or not code or not state.isascii() or not hmac.compare_digest(cookie[0], state):
        return response

    link_user = None
    if len(cookie) == 4:
        token = get_cookie(request, "session")
        if token and hmac.compare_digest(cookie[3].encode(), digest(token).encode()):
            link_user = current_user(request, db)
        if link_user is None:
            response.headers["location"] = "/auth?error=link-sign-in"
            return response

    try:
        identity = google_identity(google_config(), code, cookie[1], cookie[2])
        step = complete_google(identity, request, response, db, background, link_user)
        if step == "link-mismatch":
            response.headers["location"] = "/auth?error=link-mismatch"
        else:
            response.headers["location"] = "/dashboard" if step == "signed-in" else f"/auth?step={step}"
    except (HTTPException, IntegrityError) as error:
        db.rollback()
        if isinstance(error, HTTPException) and error.status_code in (429, 503):
            response.headers["location"] = "/auth?error=email"
    return response
