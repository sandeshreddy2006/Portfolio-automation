from conftest import content, login_as, make_user


def create(client, slug="alex", **kwargs):
    return client.post("/api/portfolios", json={"slug": slug, "draft_content": content(**kwargs)})


def test_requires_sign_in(client):
    assert client.get("/api/portfolios").status_code == 401
    assert create(client).status_code == 401


def test_create_list_and_read(client):
    owner = login_as(make_user())
    response = create(owner)
    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "alex" and body["published"] is False
    assert [item["slug"] for item in owner.get("/api/portfolios").json()] == ["alex"]
    assert owner.get("/api/portfolios/alex").json()["draft_content"]["name"] == "Alex Morgan"


def test_slug_rules(client):
    owner = login_as(make_user())
    assert create(owner, slug="admin").status_code == 409
    assert create(owner, slug="ab").status_code == 422
    assert create(owner, slug="Has Spaces").status_code == 422
    assert create(owner, slug="taken").status_code == 201
    assert create(owner, slug="taken").status_code == 409


def test_unknown_template_is_rejected(client):
    owner = login_as(make_user())
    assert create(owner, template_id="not-real").status_code == 422


def test_limit_of_five_per_user(client):
    owner = login_as(make_user())
    for number in range(5):
        assert create(owner, slug=f"site-{number}").status_code == 201
    assert create(owner, slug="site-5").status_code == 409
    other = login_as(make_user("sam@example.com"))
    assert create(other, slug="sams-site").status_code == 201


def test_other_users_cannot_touch_a_portfolio(client):
    owner = login_as(make_user())
    create(owner)
    stranger = login_as(make_user("sam@example.com"))
    assert stranger.get("/api/portfolios/alex").status_code == 404
    assert stranger.put("/api/portfolios/alex", json={"draft_content": content(name="Hacked")}).status_code == 404
    assert stranger.post("/api/portfolios/alex/publish").status_code == 404
    assert stranger.delete("/api/portfolios/alex").status_code == 404
    assert owner.get("/api/portfolios/alex").json()["draft_content"]["name"] == "Alex Morgan"


def test_publish_flow_keeps_drafts_private(client):
    owner = login_as(make_user())
    create(owner)
    assert client.get("/api/public/alex").status_code == 404

    published = owner.post("/api/portfolios/alex/publish").json()
    assert published["published"] is True and published["has_unpublished_changes"] is False
    assert client.get("/api/public/alex").json()["published_content"]["name"] == "Alex Morgan"

    edited = owner.put("/api/portfolios/alex", json={"draft_content": content(name="New Name")}).json()
    assert edited["has_unpublished_changes"] is True
    assert client.get("/api/public/alex").json()["published_content"]["name"] == "Alex Morgan"

    owner.post("/api/portfolios/alex/publish")
    assert client.get("/api/public/alex").json()["published_content"]["name"] == "New Name"

    owner.post("/api/portfolios/alex/unpublish")
    assert client.get("/api/public/alex").status_code == 404


def test_delete(client):
    owner = login_as(make_user())
    create(owner)
    owner.post("/api/portfolios/alex/publish")
    assert owner.delete("/api/portfolios/alex").status_code == 204
    assert client.get("/api/public/alex").status_code == 404
    assert owner.get("/api/portfolios").json() == []


def test_javascript_links_are_rejected(client):
    owner = login_as(make_user())
    bad = content(links=[{"label": "x", "url": "javascript:alert(1)"}])
    response = owner.post("/api/portfolios", json={"slug": "evil", "draft_content": bad})
    assert response.status_code == 422


# ---- two tabs saving at once


def revision_of(owner, slug="alex"):
    return owner.get(f"/api/portfolios/{slug}").json()["revision"]


def save(owner, name, revision, slug="alex"):
    return owner.put(f"/api/portfolios/{slug}", json={"draft_content": content(name=name), "base_revision": revision})


def test_a_stale_tab_can_not_overwrite_newer_work(client):
    owner = login_as(make_user())
    create(owner, "alex")
    first = revision_of(owner)
    assert save(owner, "Tab one", first).status_code == 200  # tab one saves
    stale = save(owner, "Tab two", first)  # tab two still holds the old revision
    assert stale.status_code == 409 and "another tab" in stale.json()["detail"]
    assert owner.get("/api/portfolios/alex").json()["draft_content"]["name"] == "Tab one"
    assert save(owner, "Tab two", revision_of(owner)).status_code == 200  # after reloading it works


def test_every_save_moves_the_revision_forward(client):
    owner = login_as(make_user())
    create(owner, "alex")
    numbers = [revision_of(owner)]
    for name in ("One", "Two", "Three"):
        save(owner, name, numbers[-1])
        numbers.append(revision_of(owner))
    assert numbers == [0, 1, 2, 3]


def test_saving_without_a_revision_still_works(client):
    owner = login_as(make_user())
    create(owner, "alex")
    assert owner.put("/api/portfolios/alex", json={"draft_content": content(name="Older client")}).status_code == 200


# ---- renaming an address


def rename(owner, old, new):
    return owner.patch(f"/api/portfolios/{old}/address", json={"slug": new})


def test_renaming_moves_the_portfolio_and_keeps_the_old_link_working(client):
    owner = login_as(make_user())
    create(owner, "old-name")
    owner.post("/api/portfolios/old-name/publish")

    assert rename(owner, "old-name", "new-name").json()["slug"] == "new-name"
    assert client.get("/api/public/new-name").status_code == 200
    assert client.get("/api/public/old-name").status_code == 404  # the page lives at the new address
    assert client.get("/api/public/old-name/redirect").json() == {"to": "new-name"}  # ...and the old one points there
    assert [item["slug"] for item in owner.get("/api/portfolios").json()] == ["new-name"]


def test_renaming_follows_chains_and_can_go_back(client):
    owner = login_as(make_user())
    create(owner, "first-name")
    rename(owner, "first-name", "second-name")
    rename(owner, "second-name", "third-name")
    assert client.get("/api/public/first-name/redirect").json() == {"to": "third-name"}  # not stuck on the middle step
    assert client.get("/api/public/second-name/redirect").json() == {"to": "third-name"}

    assert rename(owner, "third-name", "first-name").status_code == 200  # reclaiming an earlier address
    assert client.get("/api/public/first-name/redirect").status_code == 404


def test_renaming_follows_the_same_rules_as_creating(client):
    alex = login_as(make_user())
    sam = login_as(make_user("sam@example.com"))
    create(alex, "alex-site")
    create(sam, "sam-site")
    assert rename(alex, "alex-site", "admin").status_code == 409  # reserved
    assert rename(alex, "alex-site", "ab").status_code == 422  # too short
    assert rename(alex, "alex-site", "Bad Name").status_code == 422
    assert rename(alex, "alex-site", "sam-site").status_code == 409  # taken
    rename(sam, "sam-site", "sam-renamed")
    assert rename(alex, "alex-site", "sam-site").status_code == 409  # sam's old address is held for sam
    assert rename(alex, "no-such-site", "whatever").status_code == 404


def test_nobody_else_can_rename_my_portfolio(client):
    alex = login_as(make_user())
    sam = login_as(make_user("sam@example.com"))
    create(alex, "alex-site")
    assert rename(sam, "alex-site", "stolen").status_code == 404
    assert client.get("/api/public/alex-site/redirect").status_code == 404


def test_deleting_a_renamed_portfolio_stops_the_redirect(client):
    owner = login_as(make_user())
    create(owner, "old-name")
    rename(owner, "old-name", "new-name")
    owner.delete("/api/portfolios/new-name")
    assert client.get("/api/public/old-name/redirect").status_code == 404
    other = login_as(make_user("sam@example.com"))
    assert create(other, "old-name").status_code == 409  # still reserved for a while


def test_renaming_is_rate_limited(client):
    owner = login_as(make_user())
    create(owner, "name-0")
    codes = [rename(owner, f"name-{n}", f"name-{n + 1}").status_code for n in range(11)]
    assert codes[:10] == [200] * 10 and codes[10] == 429


def test_career_sections_and_project_link_publish_with_the_draft(client):
    owner = login_as(make_user())
    original = create(owner).json()
    assert original["draft_content"]["experience"] == []
    assert original["draft_content"]["credentials"] == []
    owner.post("/api/portfolios/alex/publish")

    additions = {
        "experience": [{
            "role": "Software Engineer", "company": "Example Labs",
            "dates": "Jan 2024 – Present", "description": "Built a dashboard.",
        }],
        "credentials": [{
            "title": "Cloud Certification", "issuer": "Example Academy",
            "date": "2025", "url": "https://example.com/certificate",
        }],
        "projects": [{
            "title": "Weather Desk", "description": "", "url": "https://example.com/weather",
        }],
    }
    saved = owner.put("/api/portfolios/alex", json={
        "base_revision": original["revision"], "draft_content": content(**additions),
    })
    assert saved.status_code == 200
    assert saved.json()["draft_content"]["experience"] == additions["experience"]
    assert client.get("/api/public/alex").json()["published_content"]["credentials"] == []

    assert owner.post("/api/portfolios/alex/publish").status_code == 200
    published = client.get("/api/public/alex").json()["published_content"]
    assert published["experience"] == additions["experience"]
    assert published["credentials"] == additions["credentials"]
    assert published["projects"][0]["url"] == additions["projects"][0]["url"]
