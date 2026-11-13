"""Server-side Vercel API access for platform domains and customer deployments."""

import hashlib
import os
from urllib.parse import quote

import requests
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from app.google_oauth import frontend_origin


class VercelError(HTTPException):
    def __init__(self, upstream: int, code: str = ""):
        self.upstream = upstream
        self.code = code
        if upstream in (401, 403):
            super().__init__(409, "Vercel denied access. Check the installation or project permissions.")
        elif upstream == 409:
            super().__init__(409, "Vercel reports that this resource is already in use.")
        elif upstream == 429:
            super().__init__(429, "Vercel is rate limiting requests. Try again shortly.")
        else:
            super().__init__(502, "Vercel couldn’t complete this request.")


def call(method: str, path: str, token: str | None = None, team: str | None = None, *, data=None, payload=None, extra_headers=None) -> dict:
    try:
        result = requests.request(
            method, f"https://api.vercel.com{path}", params={"teamId": team} if team else None,
            headers={**({"Authorization": f"Bearer {token}"} if token else {}), **(extra_headers or {})},
            data=data, json=payload, timeout=(5, 15), allow_redirects=False,
        )
        body = result.json() if result.content else {}
    except (requests.RequestException, ValueError) as error:
        raise VercelError(502) from error
    if not 200 <= result.status_code < 300:
        error = body.get("error", {}) if isinstance(body, dict) else {}
        raise VercelError(result.status_code, error.get("code", "") if isinstance(error, dict) else "")
    if not isinstance(body, dict):
        raise VercelError(502)
    return body


def domains_configured() -> bool:
    return bool(os.getenv("VERCEL_PLATFORM_TOKEN") and os.getenv("VERCEL_PLATFORM_PROJECT_ID"))


def platform(method: str, path: str, *, payload=None) -> dict:
    if not domains_configured():
        raise HTTPException(503, "Custom domains haven’t been configured.")
    return call(method, path, os.environ["VERCEL_PLATFORM_TOKEN"], os.getenv("VERCEL_PLATFORM_TEAM_ID"), payload=payload)


def project_domain(host: str = "") -> str:
    project = quote(os.getenv("VERCEL_PLATFORM_PROJECT_ID", ""), safe="")
    return f"/v9/projects/{project}/domains" + (f"/{quote(host, safe='')}" if host else "")


def encryption() -> Fernet:
    try:
        return Fernet(os.getenv("VERCEL_TOKEN_ENCRYPTION_KEY", "").encode())
    except ValueError as error:
        raise HTTPException(503, "Vercel connections haven’t been configured.") from error


def deployment_configured() -> bool:
    if not all(os.getenv(name) for name in ("VERCEL_INTEGRATION_SLUG", "VERCEL_INTEGRATION_CLIENT_ID", "VERCEL_INTEGRATION_CLIENT_SECRET")):
        return False
    try:
        encryption()
    except HTTPException:
        return False
    return True


def exchange(code: str) -> dict:
    return call("POST", "/v2/oauth/access_token", data={
        "client_id": os.environ["VERCEL_INTEGRATION_CLIENT_ID"],
        "client_secret": os.environ["VERCEL_INTEGRATION_CLIENT_SECRET"],
        "code": code,
        "redirect_uri": f"{frontend_origin()}/api/hosting/vercel/callback",
    })


def decrypt(encrypted_token: str) -> str:
    try:
        return encryption().decrypt(encrypted_token.encode()).decode()
    except InvalidToken as error:
        raise HTTPException(409, "Reconnect your Vercel account to continue.") from error


def deploy_files(name: str, project_id: str, files: dict[str, bytes], token: str, team: str | None) -> dict:
    refs = []
    uploaded = set()
    for path, contents in files.items():
        digest = hashlib.sha1(contents, usedforsecurity=False).hexdigest()
        if digest not in uploaded:
            call("POST", "/v2/files", token, team, data=contents, extra_headers={
                "Content-Type": "application/octet-stream", "x-vercel-digest": digest,
            })
            uploaded.add(digest)
        refs.append({"file": path, "sha": digest, "size": len(contents)})
    return call("POST", "/v13/deployments", token, team, payload={
        "name": name, "project": project_id, "target": "production",
        "files": refs, "projectSettings": {"framework": None, "buildCommand": "", "installCommand": ""},
    })
