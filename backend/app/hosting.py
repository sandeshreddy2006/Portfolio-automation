"""Owner-only publishing settings and the public custom-domain lookup."""

import logging
import os
import re
import secrets
import time
from urllib.parse import quote, urlencode, urlsplit

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app import domains, media, vercel
from app.auth import digest, get_cookie, throttle
from app.db import SessionLocal
from app.google_oauth import frontend_origin
from app.models import Portfolio, PortfolioDeployment, PortfolioDomain, VercelConnection, VercelInstallState
from app.portfolios import Database, owned_portfolio, require_user
from app.static_portfolio import export_files

router = APIRouter(prefix="/api/hosting", tags=["hosting"])
logger = logging.getLogger(__name__)
PROVIDER_ID = re.compile(r"[a-zA-Z0-9_-]{1,120}")
PENDING = {"QUEUED", "BUILDING", "INITIALIZING"}
JOB_TIMEOUT = 900


class DomainInput(BaseModel):
    hostname: str = Field(max_length=253)


class DeployInput(BaseModel):
    connection_id: str = Field(max_length=120)


def check_limit(db, user_id: int, action: str, limit: int) -> None:
    throttle(db, action, str(user_id), limit, 3600)
    db.commit()


def owned_domain(db, portfolio_id: int) -> PortfolioDomain | None:
    return db.scalar(select(PortfolioDomain).where(PortfolioDomain.portfolio_id == portfolio_id))


def deployment_payload(row: PortfolioDeployment) -> dict:
    status = "ERROR" if row.status == "PREPARING" and row.started_at < time.time() - JOB_TIMEOUT else row.status
    return {
        "connection_id": row.connection_id, "status": status, "url": row.url,
        "error": row.error or ("The export timed out. Try deploying again." if status != row.status else None),
    }


def apply_deployment_result(row: PortfolioDeployment, result: dict) -> None:
    state = result.get("readyState") or result.get("status")
    row.status = state if state in PENDING | {"READY", "ERROR", "CANCELED"} else "QUEUED"
    if row.status == "READY" and result.get("aliasAssigned") is False:
        row.status = "INITIALIZING"
    if row.status == "READY":
        aliases = result.get("alias") or []
        if not isinstance(aliases, list):
            aliases = []
        for host in [f"{row.project_name}.vercel.app", *aliases, result.get("url")]:
            if not isinstance(host, str) or not re.fullmatch(r"[a-zA-Z0-9-]+\.vercel\.app", host):
                continue
            if host == f"{row.project_name}.vercel.app" and host not in aliases:
                continue
            row.url = f"https://{host}"
            break
    if row.status == "ERROR":
        row.error = "The Vercel build failed. Check the deployment in your Vercel dashboard."


@router.get("/resolve")
def resolve_custom_domain(db: Database, host: str = Query(max_length=253)):
    slug = domains.resolve_domain(db, host.lower().rstrip("."))
    if slug is None:
        raise HTTPException(404, "Portfolio not found.")
    return {"slug": slug}


@router.get("/portfolios/{slug}")
def get_hosting(slug: str, request: Request, db: Database):
    user = require_user(request, db)
    portfolio = owned_portfolio(db, user, slug)
    connections = list(db.scalars(select(VercelConnection).where(VercelConnection.owner_id == user.id).order_by(VercelConnection.label)))
    rows = list(db.scalars(select(PortfolioDeployment).where(PortfolioDeployment.portfolio_id == portfolio.id)))
    return {
        "domains_available": vercel.domains_configured(),
        "deploy_available": vercel.deployment_configured(),
        "domain": domains.payload(owned_domain(db, portfolio.id)),
        "connections": [{"id": connection.id, "label": connection.label} for connection in connections],
        "deployments": [deployment_payload(row) for row in rows],
    }


@router.post("/portfolios/{slug}/domain", status_code=201)
def reserve_domain(slug: str, body: DomainInput, request: Request, db: Database, background: BackgroundTasks):
    if not vercel.domains_configured():
        raise HTTPException(503, "Custom domains haven’t been configured.")
    user = require_user(request, db)
    host = domains.clean_hostname(body.hostname)
    check_limit(db, user.id, "hosting-domain", 20)
    media.lock_portfolio_media(db, user.id)
    portfolio = owned_portfolio(db, user, slug)
    existing = owned_domain(db, portfolio.id)
    if existing is not None:
        if existing.hostname == host:
            return domains.payload(existing)
        raise HTTPException(409, "Disconnect the current domain before adding another.")
    claim = db.scalar(select(PortfolioDomain).where(PortfolioDomain.hostname == host).with_for_update())
    if claim is not None:
        expired = not claim.attached and claim.reserved_at < time.time() - 86400
        if claim.portfolio_id is not None and not expired:
            raise HTTPException(409, "This domain is already connected or awaiting verification.")
        domains.detach(claim)
        db.delete(claim)
        db.flush()
    domain = domains.reservation(host, portfolio.id)
    db.add(domain)
    try:
        db.commit()
    except IntegrityError as error:
        raise HTTPException(409, "This domain is already connected or awaiting verification.") from error
    background.add_task(domains.cleanup_orphan_domains)
    return domains.payload(domain)


@router.post("/portfolios/{slug}/domain/verify")
def verify_domain(slug: str, request: Request, db: Database):
    user = require_user(request, db)
    check_limit(db, user.id, "hosting-dns", 60)
    media.lock_portfolio_media(db, user.id)
    domain = owned_domain(db, owned_portfolio(db, user, slug).id)
    if domain is None:
        raise HTTPException(404, "No domain is connected.")
    try:
        domains.activate(domain)
    except HTTPException:
        # Preserve knowledge of a successful Vercel attachment even if reading DNS failed.
        db.commit()
        raise
    db.commit()
    return domains.payload(domain)


@router.delete("/portfolios/{slug}/domain", status_code=204)
def remove_domain(slug: str, request: Request, db: Database, background: BackgroundTasks):
    user = require_user(request, db)
    media.lock_portfolio_media(db, user.id)
    domain = owned_domain(db, owned_portfolio(db, user, slug).id)
    if domain:
        domain.active = False
        domain.portfolio_id = None
        db.commit()
        background.add_task(domains.cleanup_orphan_domains)
    return Response(status_code=204)


@router.post("/portfolios/{slug}/vercel/connect")
def connect_vercel(slug: str, request: Request, db: Database):
    if not vercel.deployment_configured():
        raise HTTPException(503, "Vercel connections haven’t been configured.")
    user = require_user(request, db)
    origin = request.headers.get("X-Portfolabs-Origin")
    if origin and origin != frontend_origin():
        raise HTTPException(409, f"Open {frontend_origin()} to connect your Vercel account.")
    check_limit(db, user.id, "hosting-vercel-connect", 20)
    portfolio = owned_portfolio(db, user, slug)
    state = secrets.token_urlsafe(32)
    db.execute(delete(VercelInstallState).where(VercelInstallState.expires_at <= int(time.time())))
    db.add(VercelInstallState(
        digest=digest(state), session_digest=digest(get_cookie(request, "session") or ""),
        portfolio_id=portfolio.id, expires_at=int(time.time()) + 1800,
    ))
    db.commit()
    integration = quote(os.environ["VERCEL_INTEGRATION_SLUG"], safe="")
    return {"url": f"https://vercel.com/integrations/{integration}/new?{urlencode({'state': state})}"}


@router.get("/vercel/callback")
def vercel_callback(request: Request, db: Database, state: str = "", code: str = "", configurationId: str = "", next: str = ""):
    fallback = "/dashboard?vercel=failed"
    user = require_user(request, db)
    if not vercel.deployment_configured() or len(state) > 120 or len(code) > 400:
        return RedirectResponse(fallback, status_code=303)
    pending = db.execute(
        delete(VercelInstallState).where(
            VercelInstallState.digest == digest(state),
            VercelInstallState.session_digest == digest(get_cookie(request, "session") or ""),
            VercelInstallState.expires_at > int(time.time()),
        ).returning(VercelInstallState.portfolio_id)
    ).scalar_one_or_none()
    db.commit()
    if pending is None:
        return RedirectResponse(fallback, status_code=303)
    portfolio = db.scalar(select(Portfolio).where(Portfolio.id == pending, Portfolio.owner_id == user.id))
    if portfolio is None:
        return RedirectResponse(fallback, status_code=303)
    editor = f"/editor/{portfolio.slug}"
    if not code:
        return RedirectResponse(f"{editor}?vercel=failed#sec-hosting", status_code=303)
    try:
        result = vercel.exchange(code)
        installation = result.get("installation_id")
        team = result.get("team_id")
        token = result.get("access_token")
        if (not isinstance(installation, str) or not PROVIDER_ID.fullmatch(installation)
                or (configurationId and configurationId != installation)
                or not isinstance(token, str) or not token or len(token) > 1200
                or (team and (not isinstance(team, str) or not PROVIDER_ID.fullmatch(team)))):
            raise HTTPException(502, "Vercel returned an invalid installation.")
        connection = db.get(VercelConnection, installation)
        if connection and connection.owner_id != user.id:
            raise HTTPException(409, "This Vercel installation is connected to another account.")
        label = "Personal Vercel account" if not team else f"Vercel team ({team})"
        try:
            identity = vercel.call("GET", f"/v2/teams/{quote(team, safe='')}" if team else "/v2/user", token, team)
            account = identity if team else identity.get("user", {})
            label = str(account.get("name") or account.get("username") or account.get("slug") or label)
        except vercel.VercelError:
            pass
        if connection is None:
            connection = VercelConnection(id=installation, owner_id=user.id)
            db.add(connection)
        connection.team_id = team
        connection.label = label[:160]
        connection.encrypted_token = vercel.encryption().encrypt(token.encode()).decode()
        db.commit()
    except (HTTPException, IntegrityError):
        db.rollback()
        return RedirectResponse(f"{editor}?vercel=failed#sec-hosting", status_code=303)
    # Vercel supplies a completion URL for its installation popup. The editor underneath
    # refreshes connection details when the popup closes or loses focus.
    try:
        target = urlsplit(next)
        if target.scheme == "https" and target.netloc == "vercel.com":
            return RedirectResponse(next, status_code=303)
    except ValueError:
        pass
    return RedirectResponse(f"{editor}?vercel=connected#sec-hosting", status_code=303)


def run_deployment(portfolio_id: int, connection_id: str, started_at: int, version) -> None:
    def job(db):
        row = db.get(PortfolioDeployment, (portfolio_id, connection_id))
        return row if row and row.started_at == started_at and row.status == "PREPARING" else None

    try:
        with SessionLocal() as db:
            row = job(db)
            portfolio = db.get(Portfolio, portfolio_id)
            connection = db.get(VercelConnection, connection_id)
            if row is None or portfolio is None or connection is None:
                return
            if portfolio.published_content is None or portfolio.published_at != version:
                raise HTTPException(409, "The published version changed. Deploy it again when ready.")
            slug, owner_id = portfolio.slug, portfolio.owner_id
            content = media.normalize_images(portfolio.published_content, owner_id)
            token, team, project_id, project_name = vercel.decrypt(connection.encrypted_token), connection.team_id, row.project_id, row.project_name
        files = export_files(slug, owner_id, content, version)
        with SessionLocal() as db:
            row = job(db)
            portfolio = db.get(Portfolio, portfolio_id)
            if row is None or portfolio is None:
                return
            if portfolio.published_at != version or portfolio.published_content is None:
                raise HTTPException(409, "The published version changed. Deploy it again when ready.")
        if not project_id:
            try:
                project = vercel.call("POST", "/v11/projects", token, team, payload={"name": project_name, "framework": None})
            except vercel.VercelError as error:
                if error.upstream != 409:
                    raise
                project = vercel.call("GET", f"/v9/projects/{quote(project_name, safe='')}", token, team)
            project_id = project.get("id")
            if not isinstance(project_id, str) or not PROVIDER_ID.fullmatch(project_id):
                raise vercel.VercelError(502)
            with SessionLocal.begin() as db:
                row = job(db)
                if row is None:
                    return
                row.project_id = project_id
        result = vercel.deploy_files(project_name, project_id, files, token, team)
        deployment_id = result.get("id")
        if not isinstance(deployment_id, str) or not PROVIDER_ID.fullmatch(deployment_id):
            raise vercel.VercelError(502)
        with SessionLocal.begin() as db:
            row = job(db)
            if row:
                row.deployment_id = deployment_id
                apply_deployment_result(row, result)
    except Exception as error:
        logger.warning("Portfolio export failed (%s)", type(error).__name__)
        with SessionLocal.begin() as db:
            row = job(db)
            if row:
                row.status = "ERROR"
                row.error = str(error.detail)[:300] if isinstance(error, HTTPException) else "Couldn’t export the portfolio. Try again."


@router.post("/portfolios/{slug}/vercel/deploy", status_code=202)
def deploy(slug: str, body: DeployInput, request: Request, db: Database, background: BackgroundTasks):
    if not vercel.deployment_configured():
        raise HTTPException(503, "Vercel deployments haven’t been configured.")
    user = require_user(request, db)
    check_limit(db, user.id, "hosting-deploy", 12)
    media.lock_portfolio_media(db, user.id)
    portfolio = owned_portfolio(db, user, slug)
    connection = db.get(VercelConnection, body.connection_id)
    if connection is None or connection.owner_id != user.id:
        raise HTTPException(404, "Vercel connection not found.")
    if portfolio.published_content is None or portfolio.published_at is None:
        raise HTTPException(409, "Publish on Portfolabs before deploying a copy.")
    now = int(time.time())
    row = db.get(PortfolioDeployment, (portfolio.id, connection.id))
    if row and row.status in PENDING | {"PREPARING"} and row.started_at > now - JOB_TIMEOUT:
        return deployment_payload(row)
    if row is None:
        row = PortfolioDeployment(
            portfolio_id=portfolio.id, connection_id=connection.id,
            project_name=f"portfolabs-{slug[:38]}-{secrets.token_hex(8)}",
        )
        db.add(row)
    row.status = "PREPARING"
    row.started_at = now
    row.error = None
    row.deployment_id = None
    db.commit()
    background.add_task(run_deployment, portfolio.id, connection.id, now, portfolio.published_at)
    return deployment_payload(row)


@router.get("/portfolios/{slug}/vercel/status")
def deployment_status(slug: str, request: Request, db: Database, connection_id: str = Query(max_length=120)):
    user = require_user(request, db)
    portfolio = owned_portfolio(db, user, slug)
    row = db.get(PortfolioDeployment, (portfolio.id, connection_id))
    connection = db.get(VercelConnection, connection_id)
    if not row or not connection or connection.owner_id != user.id:
        raise HTTPException(404, "Deployment not found.")
    if row.deployment_id and row.status in PENDING:
        token = vercel.decrypt(connection.encrypted_token)
        result = vercel.call("GET", f"/v13/deployments/{quote(row.deployment_id, safe='')}", token, connection.team_id)
        apply_deployment_result(row, result)
        db.commit()
    return deployment_payload(row)


@router.delete("/vercel/connections/{connection_id}", status_code=204)
def disconnect_vercel(connection_id: str, request: Request, db: Database):
    user = require_user(request, db)
    connection = db.get(VercelConnection, connection_id)
    if not connection or connection.owner_id != user.id:
        raise HTTPException(404, "Vercel connection not found.")
    try:
        vercel.call("DELETE", f"/v1/integrations/configuration/{quote(connection.id, safe='')}",
                    vercel.decrypt(connection.encrypted_token), connection.team_id)
    except vercel.VercelError as error:
        if error.upstream not in (401, 404) and error.code != "integration_configuration_disabled":
            raise
    db.delete(connection)
    db.commit()
    return Response(status_code=204)
