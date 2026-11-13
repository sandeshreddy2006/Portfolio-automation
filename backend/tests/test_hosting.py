from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import select

from app import domains, hosting, vercel
from app.db import SessionLocal
from app.models import VercelConnection
from app.static_portfolio import export_files
from conftest import content, login_as, make_user


@pytest.fixture(autouse=True)
def provider_config(monkeypatch):
    for name, value in {
        "VERCEL_PLATFORM_TOKEN": "qa-platform-token",
        "VERCEL_PLATFORM_PROJECT_ID": "prj_platform",
        "VERCEL_PLATFORM_TEAM_ID": "team_platform",
        "VERCEL_INTEGRATION_SLUG": "portfolabs",
        "VERCEL_INTEGRATION_CLIENT_ID": "oac_portfolabs",
        "VERCEL_INTEGRATION_CLIENT_SECRET": "qa-client-secret",
        "VERCEL_TOKEN_ENCRYPTION_KEY": Fernet.generate_key().decode(),
    }.items():
        monkeypatch.setenv(name, value)


def create(owner, slug="alex"):
    assert owner.post("/api/portfolios", json={"slug": slug, "draft_content": content()}).status_code == 201


def test_custom_domain_requires_dns_and_live_portfolio(client, monkeypatch):
    owner = login_as(make_user())
    stranger = login_as(make_user("other@example.com"))
    create(owner)
    create(stranger, "other")
    path = "/api/hosting/portfolios/alex/domain"
    assert client.post(path, json={"hostname": "jane.example.org"}).status_code == 401
    assert owner.post(path, json={"hostname": "www.portfolabs.com"}).status_code == 422
    created = owner.post(path, json={"hostname": "Jane.Example.org."})
    assert created.status_code == 201
    assert created.json()["records"][0]["name"] == "_portfolabs.jane.example.org"
    assert stranger.post("/api/hosting/portfolios/other/domain", json={"hostname": "jane.example.org"}).status_code == 409
    assert stranger.post(path + "/verify").status_code == 404
    monkeypatch.setattr(domains, "owns_domain", lambda _domain: False)
    assert owner.post(path + "/verify").status_code == 409

    calls = []
    configured = False

    def platform(method, endpoint, *, payload=None):
        calls.append((method, endpoint, payload))
        if endpoint.endswith("/config"):
            return {"recommendedCNAME": [{"rank": 1, "value": "test.vercel-dns.com"}], "misconfigured": not configured}
        return {"verified": True, "apexName": "example.org"}

    monkeypatch.setattr(vercel, "platform", platform)
    monkeypatch.setattr(domains, "owns_domain", lambda _domain: True)
    checked = owner.post(path + "/verify").json()
    assert checked["attached"] and not checked["active"]
    assert {"type": "CNAME", "name": "jane.example.org", "value": "test.vercel-dns.com"} in checked["records"]
    configured = True
    assert owner.post(path + "/verify").json()["active"]
    public = "/api/hosting/resolve?host=jane.example.org"
    assert client.get(public).status_code == 404
    assert owner.post("/api/portfolios/alex/publish").status_code == 200
    assert client.get(public).json() == {"slug": "alex"}
    assert owner.patch("/api/portfolios/alex/address", json={"slug": "renamed"}).status_code == 200
    assert client.get(public).json() == {"slug": "renamed"}
    assert owner.post("/api/portfolios/renamed/unpublish").status_code == 200
    assert client.get(public).status_code == 404
    assert owner.delete("/api/portfolios/renamed").status_code == 204
    assert ("DELETE", "/v9/projects/prj_platform/domains/jane.example.org", None) in calls


def test_vercel_connection_and_deploy_use_owner_scope(client, monkeypatch):
    owner = login_as(make_user())
    stranger = login_as(make_user("other@example.com"))
    create(owner)
    create(stranger, "other")
    path = "/api/hosting/portfolios/alex/vercel"
    start = owner.post(path + "/connect").json()["url"]
    state = parse_qs(urlsplit(start).query)["state"][0]
    calls = []

    def exchange(code):
        assert code == "qa-code"
        return {"installation_id": "icfg_qa", "access_token": "qa-customer-token", "team_id": "team_qa"}

    def call(method, endpoint, token=None, team=None, **kwargs):
        assert token == "qa-customer-token" and team == "team_qa"
        calls.append((method, endpoint))
        if endpoint == "/v2/teams/team_qa":
            return {"name": "Demo team"}
        if endpoint == "/v11/projects":
            return {"id": "prj_qa"}
        if endpoint == "/v13/deployments/dpl_qa":
            return {"readyState": "READY", "alias": ["demo-export.vercel.app"]}
        return {}

    monkeypatch.setattr(vercel, "exchange", exchange)
    monkeypatch.setattr(vercel, "call", call)
    callback = f"/api/hosting/vercel/callback?state={state}&code=qa-code&configurationId=icfg_qa"
    assert stranger.get(callback, follow_redirects=False).headers["location"] == "/dashboard?vercel=failed"
    assert owner.get(callback, follow_redirects=False).headers["location"] == "/editor/alex?vercel=connected#sec-hosting"
    assert owner.get(callback, follow_redirects=False).headers["location"] == "/dashboard?vercel=failed"

    settings = owner.get("/api/hosting/portfolios/alex").json()
    assert settings["connections"] == [{"id": "icfg_qa", "label": "Demo team"}]
    with SessionLocal() as db:
        assert db.scalar(select(VercelConnection.encrypted_token)) != "qa-customer-token"
    assert stranger.post("/api/hosting/portfolios/other/vercel/deploy", json={"connection_id": "icfg_qa"}).status_code == 404
    assert owner.post(path + "/deploy", json={"connection_id": "icfg_qa"}).status_code == 409
    assert owner.post("/api/portfolios/alex/publish").status_code == 200
    monkeypatch.setattr(hosting, "export_files", lambda *_: {"index.html": b"<h1>Published</h1>"})

    def deploy_files(name, project_id, files, token, team):
        assert name.startswith("portfolabs-alex-")
        assert project_id == "prj_qa" and team == "team_qa" and token == "qa-customer-token"
        assert files["index.html"] == b"<h1>Published</h1>"
        return {"id": "dpl_qa", "readyState": "QUEUED"}

    monkeypatch.setattr(vercel, "deploy_files", deploy_files)
    for _ in range(2):
        assert owner.post(path + "/deploy", json={"connection_id": "icfg_qa"}).status_code == 202
        assert owner.get(path + "/status?connection_id=icfg_qa").json()["url"] == "https://demo-export.vercel.app"
    assert calls.count(("POST", "/v11/projects")) == 1
    assert owner.delete("/api/hosting/vercel/connections/icfg_qa").status_code == 204


def test_export_rewrites_assets_and_strips_scripts(monkeypatch):
    from app import static_portfolio

    key = "u1/" + "a" * 32 + ".webp"
    version = datetime(2026, 11, 12, tzinfo=timezone.utc)
    page = f"""
      <link rel="stylesheet" href="/_next/static/chunks/theme.css">
      <script>window.internal = true</script>
      <div data-portfolio-export="{version.isoformat()}">
        <main><h1>Alex &amp; Jamie</h1><img src="/media/{key}"><script>bad()</script>
        <a href="/p/alex/resume">Download résumé</a></main>
      </div>
    """
    assets = {
        "/p/alex": page.encode(),
        "/_next/static/chunks/theme.css": b'@font-face{src:url(../media/font.woff2)}',
        "/_next/static/media/font.woff2": b"font",
    }
    monkeypatch.setattr(static_portfolio, "fetch_asset", lambda path, *_args, **_kwargs: assets[path])
    monkeypatch.setattr(static_portfolio.media, "read_media", lambda requested: b"photo" if requested == key else None)
    files = export_files("alex", 1, content(avatar=f"/media/{key}"), version)
    assert b"<script" not in files["index.html"]
    assert b"Alex &amp; Jamie" in files["index.html"]
    assert b'http://localhost:3000/p/alex/resume' in files["index.html"]
    assert b"/assets/theme/media/font.woff2" in files["assets/theme/chunks/theme.css"]
    assert files["assets/theme/media/font.woff2"] == b"font"
    assert files["assets/" + key.split("/")[1]] == b"photo"


def test_vercel_upload_uses_sha_references_for_static_files(monkeypatch):
    calls = []

    def call(method, path, token=None, team=None, **kwargs):
        calls.append((method, path, token, team, kwargs))
        return {"id": "dpl_test"} if path == "/v13/deployments" else {}

    monkeypatch.setattr(vercel, "call", call)
    site = {"index.html": b"example", "assets/copy.txt": b"example"}
    assert vercel.deploy_files("test-project", "prj_test", site, "qa-token", "team_qa")["id"] == "dpl_test"
    assert len(calls) == 2
    assert calls[0][:4] == ("POST", "/v2/files", "qa-token", "team_qa")
    digest = calls[0][4]["extra_headers"]["x-vercel-digest"]
    payload = calls[1][4]["payload"]
    assert payload["project"] == "prj_test" and payload["target"] == "production"
    assert payload["files"] == [{"file": path, "sha": digest, "size": 7} for path in site]
