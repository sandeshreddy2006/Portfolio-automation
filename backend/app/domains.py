"""Verified portfolio aliases on the platform's Vercel project."""

import logging
import os
import re
import secrets
import time
from urllib.parse import urlsplit

import dns.exception
import dns.resolver
from fastapi import HTTPException
from sqlalchemy import select

from app import vercel
from app.db import SessionLocal
from app.google_oauth import frontend_origin
from app.models import Portfolio, PortfolioDomain

logger = logging.getLogger(__name__)


def clean_hostname(value: str) -> str:
    try:
        host = value.strip().rstrip(".").lower().encode("idna").decode("ascii")
    except UnicodeError as error:
        raise HTTPException(422, "Enter a domain such as janedoe.dev.") from error
    labels = host.split(".")
    if (len(host) > 253 or len(labels) < 2 or not re.fullmatch(r"[a-z][a-z0-9-]{1,62}", labels[-1])
            or any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", part) for part in labels)):
        raise HTTPException(422, "Enter a domain without a protocol, port, or path.")
    app_host = urlsplit(frontend_origin()).hostname or ""
    roots = {"portfolabs.com", "vercel.app", "localhost", "local", "test", "internal", app_host,
             app_host.removeprefix("www."), os.getenv("PORTFOLABS_ROOT_DOMAIN", "").strip().lower()}
    if any(root and (host == root or host.endswith(f".{root}")) for root in roots):
        raise HTTPException(422, "Use a domain you own outside the Portfolabs and Vercel domains.")
    return host


def reservation(host: str, portfolio_id: int) -> PortfolioDomain:
    return PortfolioDomain(
        hostname=host, portfolio_id=portfolio_id, challenge=f"portfolabs={secrets.token_urlsafe(24)}",
        active=False, attached=False, records=[], reserved_at=int(time.time()),
    )


def challenge_name(domain: PortfolioDomain) -> str:
    return f"_portfolabs.{domain.hostname}"


def payload(domain: PortfolioDomain | None):
    if domain is None:
        return None
    return {
        "hostname": domain.hostname, "active": domain.active, "attached": domain.attached,
        "records": [{"type": "TXT", "name": challenge_name(domain), "value": domain.challenge}, *domain.records],
    }


def owns_domain(domain: PortfolioDomain) -> bool:
    try:
        return any(b"".join(record.strings).decode("ascii", errors="replace") == domain.challenge
                   for record in dns.resolver.resolve(challenge_name(domain) + ".", "TXT", lifetime=4))
    except dns.exception.DNSException:
        return False


def activate(domain: PortfolioDomain) -> None:
    if not domain.attached:
        if not owns_domain(domain):
            raise HTTPException(409, "The Portfolabs TXT record hasn’t been found. Check the record and try again.")
        try:
            result = vercel.platform("POST", vercel.project_domain(), payload={"name": domain.hostname})
        except vercel.VercelError as error:
            if error.upstream not in (400, 409) or error.code not in {"domain_already_in_use", "domain_already_exists", "domain_already_added"}:
                raise
            # Only reuse an alias if Vercel confirms it belongs to our configured project.
            result = vercel.platform("GET", vercel.project_domain(domain.hostname))
        domain.attached = True
    else:
        result = vercel.platform("GET", vercel.project_domain(domain.hostname))

    if not result.get("verified"):
        try:
            result = {**result, **vercel.platform("POST", f"{vercel.project_domain(domain.hostname)}/verify")}
        except vercel.VercelError as error:
            if error.upstream not in (400, 409):
                raise

    config = vercel.platform("GET", f"/v6/domains/{domain.hostname}/config")
    records = []
    for record in result.get("verification", []):
        if record.get("type") and record.get("domain") and record.get("value"):
            records.append({"type": record["type"], "name": record["domain"], "value": record["value"]})
    choices = config.get("recommendedIPv4", []) if result.get("apexName") == domain.hostname else config.get("recommendedCNAME", [])
    if choices:
        preferred = min(choices, key=lambda option: int(option.get("rank", 99))).get("value")
        values = preferred if isinstance(preferred, list) else [preferred]
        records.extend({"type": "A" if result.get("apexName") == domain.hostname else "CNAME",
                        "name": domain.hostname, "value": value} for value in values if isinstance(value, str) and value)
    domain.records = records
    domain.active = result.get("verified") is True and config.get("misconfigured") is False


def detach(domain: PortfolioDomain) -> None:
    if not domain.attached:
        return
    try:
        vercel.platform("DELETE", vercel.project_domain(domain.hostname))
    except vercel.VercelError as error:
        if error.upstream != 404:
            raise


def cleanup_orphan_domains() -> None:
    if not vercel.domains_configured():
        return
    with SessionLocal() as db:
        hosts = list(db.scalars(select(PortfolioDomain.hostname).where(PortfolioDomain.portfolio_id.is_(None)).limit(10)))
    for host in hosts:
        try:
            with SessionLocal.begin() as db:
                domain = db.scalar(select(PortfolioDomain).where(
                    PortfolioDomain.hostname == host, PortfolioDomain.portfolio_id.is_(None),
                ).with_for_update())
                if domain is not None:
                    detach(domain)
                    db.delete(domain)
        except Exception as error:
            logger.warning("Custom domain cleanup failed (%s)", type(error).__name__)


def resolve_domain(db, host: str) -> str | None:
    return db.scalar(
        select(Portfolio.slug).join(PortfolioDomain, PortfolioDomain.portfolio_id == Portfolio.id)
        .where(PortfolioDomain.hostname == host, PortfolioDomain.active.is_(True), Portfolio.published_content.is_not(None))
    )
