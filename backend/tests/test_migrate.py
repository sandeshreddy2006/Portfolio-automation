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
