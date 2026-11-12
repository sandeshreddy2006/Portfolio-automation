from app import media
from conftest import content, login_as, make_user


PDF = b"%PDF-1.7\n%%EOF\n"


def upload_resume(owner, data=PDF):
    return owner.post("/api/profile/resume", content=data, headers={"Content-Type": "application/pdf"})


def test_saved_profile_is_private_and_keeps_its_photo(client, tmp_path, monkeypatch):
    from test_uploads import image_bytes, upload

    monkeypatch.setattr(media, "LOCAL_DIR", tmp_path)
    monkeypatch.setattr(media, "r2_configured", lambda: False)
    owner = login_as(make_user())
    stranger = login_as(make_user("other@example.com"))
    assert client.get("/api/profile").status_code == 401
    assert owner.get("/api/profile").json()["content"]["name"] == "Alex"
    photo = upload(owner, image_bytes(), kind="avatar").json()["url"]
    data = content(name="Alex Morgan", avatar=photo, experience=[{"role": "Developer"}])
    assert owner.put("/api/profile", json=data).status_code == 200
    assert owner.get("/api/profile").json()["content"]["experience"][0]["role"] == "Developer"
    assert stranger.get("/api/profile").json()["content"]["avatar"] is None
    assert stranger.put("/api/profile", json=data).status_code == 422
    assert client.get(photo).status_code == 404

    assert owner.post("/api/portfolios", json={"slug": "alex", "draft_content": data}).status_code == 201
    assert owner.delete("/api/portfolios/alex").status_code == 204
    assert owner.get(photo).status_code == 200


def test_resume_download_follows_published_opt_in_and_pdf_version(client, tmp_path, monkeypatch):
    monkeypatch.setattr(media, "LOCAL_DIR", tmp_path)
    monkeypatch.setattr(media, "r2_configured", lambda: False)
    owner = login_as(make_user())
    stranger = login_as(make_user("other@example.com"))
    assert upload_resume(client).status_code == 401
    assert upload_resume(owner, b"not a PDF").status_code == 422
    uploaded = upload_resume(owner)
    assert uploaded.status_code == 201
    resume_id = uploaded.json()["resume_id"]
    private = owner.get("/api/profile/resume")
    assert private.content == PDF
    assert "attachment" in private.headers["content-disposition"]
    assert stranger.get("/api/profile/resume").status_code == 404
    assert client.get("/api/profile/resume").status_code == 401

    assert owner.post("/api/portfolios", json={"slug": "alex", "draft_content": content()}).status_code == 201
    public = "/api/public/alex/resume"
    assert owner.post("/api/portfolios/alex/publish").status_code == 200
    assert client.get(public).status_code == 404

    assert owner.put("/api/portfolios/alex", json={"draft_content": content(resume_id=resume_id)}).status_code == 200
    assert client.get(public).status_code == 404
    assert owner.post("/api/portfolios/alex/publish").status_code == 200
    assert client.get(public).content == PDF
    assert client.get(public).headers["cache-control"] == "private, no-store"

    assert owner.put("/api/portfolios/alex", json={"draft_content": content()}).status_code == 200
    assert client.get(public).status_code == 200
    assert owner.post("/api/portfolios/alex/publish").status_code == 200
    assert client.get(public).status_code == 404
    assert owner.put("/api/portfolios/alex", json={"draft_content": content(resume_id=resume_id)}).status_code == 200
    assert owner.post("/api/portfolios/alex/publish").status_code == 200

    replacement = upload_resume(owner, b"%PDF-1.7\nNew copy\n%%EOF\n").json()["resume_id"]
    assert replacement != resume_id
    assert client.get(public).status_code == 404
    assert client.get("/api/public/alex").json()["published_content"]["resume_id"] is None
    assert not (tmp_path / media.resume_key(1, resume_id)).exists()
    assert owner.delete("/api/profile/resume").status_code == 204
    assert owner.get("/api/profile/resume").status_code == 404
    assert not list(tmp_path.rglob("*.pdf"))
