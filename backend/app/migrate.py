"""Reconcile the dedicated application database with the SQLAlchemy models."""

import logging
import os
from uuid import uuid4

from sqlalchemy import Connection, Engine, MetaData, inspect, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.schema import CreateIndex, CreateTable

from app.db import Base, engine
from app.models import SchemaDeployment

logger = logging.getLogger(__name__)


def rebuild_sqlite_table(connection: Connection, model, columns: set[str]) -> None:
    triggers = connection.exec_driver_sql(
        "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = ?", (model.name,)
    ).scalars().all()
    if triggers:
        raise RuntimeError(f"Cannot rebuild {model.name} while it has triggers.")

    preparer = connection.dialect.identifier_preparer
    quote = preparer.quote
    original = quote(model.name)
    temporary_name = f"_migration_{uuid4().hex}"
    temporary = quote(temporary_name)
    metadata = MetaData()
    for table in Base.metadata.tables.values():
        if table is not model:
            table.to_metadata(metadata)
    replacement = model.to_metadata(metadata, name=temporary_name)

    retained = ", ".join(quote(column.name) for column in model.columns if column.name in columns)
    if not retained:
        raise RuntimeError(f"Cannot rebuild {model.name} without any shared columns.")
    connection.execute(CreateTable(replacement))
    connection.exec_driver_sql(f"INSERT INTO {temporary} ({retained}) SELECT {retained} FROM {original}")
    connection.exec_driver_sql(f"DROP TABLE {original}")
    connection.exec_driver_sql(f"ALTER TABLE {temporary} RENAME TO {original}")
    for index in model.indexes:
        connection.execute(CreateIndex(index))


def drop_sqlite_columns(connection: Connection, model, columns: set[str], unknown: set[str]) -> None:
    quote = connection.dialect.identifier_preparer.quote
    try:
        with connection.begin_nested():
            for index in inspect(connection).get_indexes(model.name):
                if unknown.intersection(index["column_names"]):
                    connection.exec_driver_sql(f"DROP INDEX {quote(index['name'])}")
            for column in sorted(unknown):
                connection.exec_driver_sql(f"ALTER TABLE {quote(model.name)} DROP COLUMN {quote(column)}")
    except OperationalError:
        # SQLite cannot drop columns covered by table-level constraints.
        rebuild_sqlite_table(connection, model, columns)


def reconcile(connection: Connection, deployment_id: str | None) -> None:
    sqlite = connection.dialect.name == "sqlite"
    if not sqlite:
        connection.exec_driver_sql("SELECT pg_advisory_xact_lock(80336924018423)")

    deployments = SchemaDeployment.__table__
    deployments.create(connection, checkfirst=True)
    if deployment_id and connection.scalar(
        select(deployments.c.deployment_id).where(deployments.c.deployment_id == deployment_id)
    ):
        return

    inspector = inspect(connection)
    preparer = connection.dialect.identifier_preparer
    quote = preparer.quote

    def table_name(name: str) -> str:
        if sqlite:
            return quote(name)
        return f"{preparer.quote_schema(inspector.default_schema_name)}.{quote(name)}"

    models = {table.name: table for table in Base.metadata.tables.values()}
    existing = set(inspector.get_table_names())
    stale_tables = sorted(existing - models.keys())
    if sqlite:
        for name in stale_tables:
            connection.exec_driver_sql(f"DROP TABLE IF EXISTS {table_name(name)}")
    elif stale_tables:
        # Drop the set together so dependencies among stale tables are allowed.
        # No CASCADE, so unrelated views or surviving constraints are protected.
        connection.exec_driver_sql("DROP TABLE " + ", ".join(map(table_name, stale_tables)))

    dropped_columns = 0
    for name in sorted(existing & models.keys()):
        columns = {column["name"] for column in inspector.get_columns(name)}
        unknown = columns - {column.name for column in models[name].columns}
        if not unknown:
            continue
        if sqlite:
            drop_sqlite_columns(connection, models[name], columns, unknown)
        else:
            for column in sorted(unknown):
                connection.exec_driver_sql(f"ALTER TABLE {table_name(name)} DROP COLUMN {quote(column)}")
        dropped_columns += len(unknown)

    Base.metadata.create_all(connection)
    if sqlite and connection.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
        raise RuntimeError("Schema migration would leave invalid foreign keys.")
    if deployment_id:
        connection.execute(deployments.insert().values(deployment_id=deployment_id))
    logger.info("Schema reconciliation removed %d tables and %d columns", len(stale_tables), dropped_columns)


def migrate_schema(database: Engine, deployment_id: str | None = None) -> None:
    if database.dialect.name == "postgresql":
        with database.begin() as connection:
            reconcile(connection, deployment_id)
        return
    if database.dialect.name != "sqlite":
        raise RuntimeError("Schema migration supports PostgreSQL and SQLite.")

    with database.connect() as connection:
        foreign_keys = connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one()
        connection.exec_driver_sql("PRAGMA foreign_keys = OFF")
        connection.commit()
        try:
            with connection.begin():
                # sqlite3 does not start a transaction for DDL by default.
                connection.exec_driver_sql("BEGIN IMMEDIATE")
                reconcile(connection, deployment_id)
        finally:
            if foreign_keys:
                connection.exec_driver_sql("PRAGMA foreign_keys = ON")


if __name__ == "__main__":
    migrate_schema(engine, os.getenv("RAILWAY_DEPLOYMENT_ID"))
