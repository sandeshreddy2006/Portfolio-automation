from sqlalchemy import create_engine, inspect, text

from app.migrate import migrate_schema


def test_migration_never_drops_tables_or_data(tmp_path):
    database = create_engine(f"sqlite:///{(tmp_path / 'old.db').as_posix()}")
    with database.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE legacy_notes (id INTEGER PRIMARY KEY, body TEXT)")
        connection.exec_driver_sql("INSERT INTO legacy_notes (body) VALUES ('keep me')")

    migrate_schema(database)

    with database.connect() as connection:
        assert connection.exec_driver_sql("SELECT body FROM legacy_notes").scalar() == "keep me"
    assert "portfolios" in inspect(database).get_table_names()


def test_migration_adds_missing_columns_and_keeps_rows(tmp_path):
    database = create_engine(f"sqlite:///{(tmp_path / 'old.db').as_posix()}")
    with database.begin() as connection:
        # The shape of the portfolios table before owner_id existed.
        connection.exec_driver_sql(
            "CREATE TABLE portfolios (id INTEGER PRIMARY KEY, slug VARCHAR(64) UNIQUE, "
            "draft_content JSON, published_content JSON, published_at DATETIME, "
            "created_at DATETIME, updated_at DATETIME)"
        )
        connection.execute(text("INSERT INTO portfolios (slug, draft_content) VALUES ('old', '{}')"))

    migrate_schema(database)

    columns = {column["name"] for column in inspect(database).get_columns("portfolios")}
    assert "owner_id" in columns
    with database.connect() as connection:
        assert connection.exec_driver_sql("SELECT slug FROM portfolios").scalar() == "old"


def test_migration_is_repeatable(tmp_path):
    database = create_engine(f"sqlite:///{(tmp_path / 'new.db').as_posix()}")
    migrate_schema(database, "deploy-1")
    migrate_schema(database, "deploy-1")
    migrate_schema(database, "deploy-2")


def test_deployment_cleanup_releases_legacy_holds_once_and_preserves_live_rows(tmp_path, monkeypatch):
    from app.models import AuthRateLimit, SlugHold, User

    monkeypatch.setattr("app.migrate.time.time", lambda: 1000)
    database = create_engine(f"sqlite:///{(tmp_path / 'cleanup.db').as_posix()}")
    migrate_schema(database)
    holds = SlugHold.__table__
    limits = AuthRateLimit.__table__
    with database.begin() as connection:
        connection.execute(User.__table__.insert().values(
            id=1, name="Alex", email="alex@example.com", password_hash="unused",
        ))
        connection.execute(holds.insert(), [
            {"slug": "expired", "owner_id": 1, "until": 999, "redirect_to": None},
            {"slug": "old-deletion", "owner_id": None, "until": 2000, "redirect_to": None},
            {"slug": "missing-owner", "owner_id": 9, "until": 2000, "redirect_to": None},
            {"slug": "reserved", "owner_id": 1, "until": 2000, "redirect_to": None},
            {"slug": "redirect", "owner_id": 1, "until": 2000, "redirect_to": "current"},
        ])
        connection.execute(limits.insert(), [
            {"key": "expired", "attempts": 1, "expires_at": 1000},
            {"key": "active", "attempts": 1, "expires_at": 1100},
        ])

    migrate_schema(database, "deploy-1")
    with database.begin() as connection:
        assert set(connection.scalars(holds.select().with_only_columns(holds.c.slug))) == {"reserved", "redirect"}
        assert list(connection.scalars(limits.select().with_only_columns(limits.c.key))) == ["active"]
        connection.execute(holds.insert().values(slug="late-legacy-hold", until=2000))

    migrate_schema(database, "deploy-1")
    with database.connect() as connection:
        assert connection.execute(holds.select().where(holds.c.slug == "late-legacy-hold")).first()

    migrate_schema(database, "deploy-2")
    with database.connect() as connection:
        assert connection.execute(holds.select().where(holds.c.slug == "late-legacy-hold")).first() is None
