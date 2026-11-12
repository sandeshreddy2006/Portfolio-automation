import io
from unittest.mock import Mock

import pytest
from PIL import Image
from sqlalchemy import select

from app import auth_email, media, portfolios, uploads
from app.db import SessionLocal
from app.models import Portfolio
from conftest import content, login_as, make_user


@pytest.fixture(autouse=True)
def local_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(media, "LOCAL_DIR", tmp_path / "uploads")


def image_bytes(fmt="PNG", size=(1200, 800), **save_kwargs) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (200, 80, 40)).save(buffer, fmt, **save_kwargs)
    return buffer.getvalue()


def upload(client, data, kind="project", content_type="image/png"):
    return client.post(f"/api/uploads?kind={kind}", content=data, headers={"content-type": content_type})


def test_upload_requires_sign_in(client):
    assert upload(client, image_bytes()).status_code == 401


def test_upload_is_resized_and_reencoded_as_webp(client):
    owner = login_as(make_user())
    response = upload(owner, image_bytes(size=(4000, 3000)), kind="avatar")
    assert response.status_code == 201
    url = response.json()["url"]
    assert url.startswith(media.media_base() + "/u1/") and url.endswith(".webp")

    stored = next(media.LOCAL_DIR.rglob("*.webp"))
    with Image.open(stored) as image:
        assert image.format == "WEBP"
        assert max(image.size) == 800  # avatars are capped at 800px


def test_metadata_such_as_gps_is_stripped(client):
    exif = Image.Exif()
    exif[0x010F] = "SecretCameraMaker"
    exif[0x8825] = {1: "N", 2: (51.0, 30.0, 0.0)}  # GPS block
    owner = login_as(make_user())
    assert upload(owner, image_bytes("JPEG", exif=exif), content_type="image/jpeg").status_code == 201
    data = next(media.LOCAL_DIR.rglob("*.webp")).read_bytes()
    assert b"SecretCameraMaker" not in data
    with Image.open(io.BytesIO(data)) as image:
        assert not image.getexif()


@pytest.mark.parametrize("payload,status", [
    (b"definitely not an image", 422),
    (b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", 422),
    (image_bytes("GIF"), 415),
    (b"", 422),
])
def test_bad_files_are_rejected(client, payload, status):
    owner = login_as(make_user())
    assert upload(owner, payload).status_code == status
    assert not list(media.LOCAL_DIR.rglob("*")) or not list(media.LOCAL_DIR.rglob("*.webp"))


def test_non_image_content_type_is_rejected(client):
    owner = login_as(make_user())
    assert upload(owner, image_bytes(), content_type="text/html").status_code == 415


def test_oversized_upload_is_rejected(client, monkeypatch):
    monkeypatch.setattr(media, "MAX_UPLOAD_BYTES", 1000)
    owner = login_as(make_user())
    assert upload(owner, image_bytes()).status_code == 413


def test_decompression_bomb_is_rejected(client):
    buffer = io.BytesIO()
    Image.new("1", (10000, 10000)).save(buffer, "PNG")  # 100 megapixels, tiny on the wire
    owner = login_as(make_user())
    assert buffer.tell() < media.MAX_UPLOAD_BYTES
    assert upload(owner, buffer.getvalue()).status_code == 422


def test_unknown_kind_is_rejected(client):
    owner = login_as(make_user())
    assert upload(owner, image_bytes(), kind="banner").status_code == 422


def test_upload_quota(client, monkeypatch):
    monkeypatch.setattr(uploads, "MAX_FILES_PER_USER", 2)
    owner = login_as(make_user())
    assert upload(owner, image_bytes()).status_code == 201
    assert upload(owner, image_bytes()).status_code == 201
    assert upload(owner, image_bytes()).status_code == 409


def test_portfolio_accepts_only_the_owners_own_images(client):
    alex = login_as(make_user())
    sam = login_as(make_user("sam@example.com"))
    alex_image = upload(alex, image_bytes()).json()["url"]
    sam_image = upload(sam, image_bytes()).json()["url"]

    def create(who, slug, **extra):
        return who.post("/api/portfolios", json={"slug": slug, "draft_content": content(**extra)})

    assert create(alex, "mine", avatar=alex_image).status_code == 201
    assert create(alex, "theirs", avatar=sam_image).status_code == 422  # another user's image
    assert create(alex, "remote", avatar="https://evil.example/pixel.png").status_code == 422
    assert create(alex, "traversal", avatar=f"{media.media_base()}/u1/../u2/x.webp").status_code == 422
    project = {"title": "A", "description": "", "url": None, "image": "https://evil.example/x.png"}
    assert create(alex, "proj", projects=[project]).status_code == 422
    good = {"title": "A", "description": "", "url": None, "image": alex_image}
    assert create(alex, "good-one", projects=[good]).status_code == 201


def test_media_visibility_follows_the_published_snapshot(client):
    owner = login_as(make_user())
    stranger = login_as(make_user("stranger@example.com"))
    image = upload(owner, image_bytes()).json()["url"]
    assert owner.get(image).status_code == 200
    assert client.get(image).status_code == 404
    assert stranger.get(image).status_code == 404

    assert owner.post("/api/portfolios", json={"slug": "alex", "draft_content": content(avatar=image)}).status_code == 201
    assert client.get(image).status_code == 404
    assert owner.post("/api/portfolios/alex/publish").status_code == 200
    public = client.get(image)
    assert public.status_code == 200
    assert public.headers["content-type"] == "image/webp"
    assert "no-store" in public.headers["cache-control"]

    draft_image = upload(owner, image_bytes()).json()["url"]
    assert owner.put("/api/portfolios/alex", json={"draft_content": content(avatar=draft_image)}).status_code == 200
    assert client.get(draft_image).status_code == 404
    assert client.get(image).status_code == 200
    assert owner.post("/api/portfolios/alex/unpublish").status_code == 200
    assert client.get(image).status_code == 404
    assert owner.get(draft_image).status_code == 200


def test_legacy_image_is_served_from_private_r2(client, monkeypatch):
    owner = login_as(make_user())
    image = upload(owner, image_bytes()).json()["url"]
    key = image.removeprefix("/media/")
    stored = (media.LOCAL_DIR / key).read_bytes()
    assert owner.post("/api/portfolios", json={"slug": "alex", "draft_content": content(avatar=image)}).status_code == 201
    assert owner.post("/api/portfolios/alex/publish").status_code == 200
    with SessionLocal.begin() as db:
        portfolio = db.scalar(select(Portfolio).where(Portfolio.slug == "alex"))
        legacy = f"https://old-assets.example.com/{key}"
        portfolio.draft_content = {**portfolio.draft_content, "avatar": legacy}
        portfolio.published_content = {**portfolio.published_content, "avatar": legacy}

    for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"):
        monkeypatch.setenv(name, "example")
    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)
    storage = Mock()
    storage.get_object.return_value = {"Body": io.BytesIO(stored)}
    monkeypatch.setattr(media, "r2_client", lambda: storage)

    assert media.r2_configured()
    assert owner.get("/api/portfolios/alex").json()["draft_content"]["avatar"] == image
    assert client.get("/api/public/alex").json()["published_content"]["avatar"] == image
    assert client.get(image).content == stored
    storage.get_object.assert_called_once_with(Bucket="example", Key=key)


def test_first_publish_sends_one_email(client, monkeypatch):
    sent = []
    monkeypatch.setattr(portfolios, "send_portfolio_live", lambda *args: sent.append(args))
    owner = login_as(make_user())
    owner.post("/api/portfolios", json={"slug": "alex", "draft_content": content()})
    owner.post("/api/portfolios/alex/publish")
    owner.post("/api/portfolios/alex/publish")  # republishing must not email again
    assert len(sent) == 1
    email, _, portfolio_name, link = sent[0]
    assert email == "alex@example.com" and portfolio_name == "Alex Morgan"
    assert link == "http://localhost:3000/p/alex"


def test_live_email_escapes_user_supplied_names(monkeypatch):
    captured = {}
    monkeypatch.setattr(auth_email, "deliver_account_email", lambda *a, **k: captured.update(args=a, kwargs=k))
    auth_email.send_portfolio_live("a@example.com", "<b>Eve</b> Smith", "<script>alert(1)</script>", "https://www.portfolabs.com/p/x")
    message = captured["args"][2]
    assert "<script>" not in message and "&lt;script&gt;" in message
    assert "<b>" not in message


def test_deleting_an_account_removes_stored_images(client):
    owner = login_as(make_user())
    upload(owner, image_bytes())
    assert list(media.LOCAL_DIR.rglob("*.webp"))
    with SessionLocal() as db:
        media.purge_user_media(db, 1)
    assert not list(media.LOCAL_DIR.rglob("*.webp"))

