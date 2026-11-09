"""Google authorization-code flow with PKCE and verified OpenID claims."""

import base64
import hashlib
import json
import os
import secrets
from dataclasses import dataclass
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import HTTPException
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.id_token import verify_oauth2_token

from app.schemas import GoogleIdentity


def frontend_origin() -> str:
    return (os.getenv("FRONTEND_URL") or "http://localhost:3000").split(",")[0].strip().rstrip("/")


@dataclass(frozen=True)
class GoogleConfig:
    client_id: str
    secret: str
    origin: str

    @property
    def redirect_uri(self) -> str:
        return f"{self.origin}/api/auth/google/callback"


def google_config() -> GoogleConfig:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not secret:
        raise HTTPException(503, "Google sign-in is not configured.")
    return GoogleConfig(client_id, secret, frontend_origin())


def google_authorization(config: GoogleConfig) -> tuple[str, str]:
    state, verifier, nonce = (secrets.token_urlsafe(32) for _ in range(3))
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    query = urlencode({
        "client_id": config.client_id, "redirect_uri": config.redirect_uri, "response_type": "code",
        "scope": "openid email profile", "state": state, "nonce": nonce, "prompt": "select_account",
        "code_challenge": challenge, "code_challenge_method": "S256",
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}", f"{state}.{verifier}.{nonce}"


def google_identity(config: GoogleConfig, code: str, verifier: str, nonce: str) -> GoogleIdentity:
    request = Request(
        "https://oauth2.googleapis.com/token",
        data=urlencode({
            "code": code, "client_id": config.client_id, "client_secret": config.secret,
            "redirect_uri": config.redirect_uri, "grant_type": "authorization_code",
            "code_verifier": verifier,
        }).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    def certificate_request(url, **kwargs):
        kwargs["timeout"] = 5
        return transport(url, **kwargs)

    try:
        with urlopen(request, timeout=8) as response:
            token = json.load(response)["id_token"]
        transport = GoogleRequest()
        claims = verify_oauth2_token(token, certificate_request, config.client_id)
        if (
            claims.get("nonce") != nonce
            or claims.get("email_verified") is not True
            or claims.get("azp", config.client_id) != config.client_id
        ):
            raise ValueError("Invalid Google claims")
        email = claims["email"]
        name = claims.get("name")
        return GoogleIdentity(
            subject=claims["sub"], email=email,
            name=name.strip()[:120] if isinstance(name, str) else "",
        )
    except (OSError, KeyError, TypeError, ValueError, GoogleAuthError) as error:
        raise HTTPException(401, "Google sign-in could not be verified.") from error
