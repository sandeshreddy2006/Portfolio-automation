"""Bring the database up to date with the SQLAlchemy models without ever dropping data.

This only creates missing tables, columns and indexes. Removing or reshaping a
column is a deliberate change and needs a hand-written migration, so nothing
here deletes data when a deployment's models differ from the database.
"""

import logging
import os

from sqlalchemy import Connection, Engine, Table, inspect, select

from app.db import Base, engine
from app.models import SchemaDeployment

logger = logging.getLogger(__name__)


def add_missing_columns(connection: Connection, table: Table) -> int:
    quote = connection.dialect.identifier_preparer.quote
    existing = {column["name"] for column in inspect(connection).get_columns(table.name)}
    added = 0
    for column in table.columns:
        if column.name in existing:
            continue
        if not column.nullable or column.unique:
            raise RuntimeError(
                f"Adding {table.name}.{column.name} needs a hand-written migration: "
                "new columns on existing tables must be nullable and not unique."
            )
        ddl = (
            f"ALTER TABLE {quote(table.name)} ADD COLUMN {quote(column.name)} "
            f"{column.type.compile(dialect=connection.dialect)}"
        )
        for key in column.foreign_keys:
            ddl += f" REFERENCES {quote(key.column.table.name)} ({quote(key.column.name)})"
            if key.ondelete:
                ddl += f" ON DELETE {key.ondelete}"
        connection.exec_driver_sql(ddl)
        added += 1
    return added


def reconcile(connection: Connection, deployment_id: str | None) -> None:
    if connection.dialect.name != "sqlite":
        connection.exec_driver_sql("SELECT pg_advisory_xact_lock(80336924018423)")

    deployments = SchemaDeployment.__table__
    deployments.create(connection, checkfirst=True)
    if deployment_id and connection.scalar(
        select(deployments.c.deployment_id).where(deployments.c.deployment_id == deployment_id)
    ):
        return

    existing = set(inspect(connection).get_table_names())
    Base.metadata.create_all(connection)

    added = 0
    for table in Base.metadata.sorted_tables:
        if table.name in existing:
            added += add_missing_columns(connection, table)
        for index in table.indexes:
            index.create(connection, checkfirst=True)

    if deployment_id:
        connection.execute(deployments.insert().values(deployment_id=deployment_id))
    logger.info("Schema reconciliation added %d columns", added)


def migrate_schema(database: Engine, deployment_id: str | None = None) -> None:
    if database.dialect.name not in ("postgresql", "sqlite"):
        raise RuntimeError("Schema migration supports PostgreSQL and SQLite.")
    with database.begin() as connection:
        reconcile(connection, deployment_id)


if __name__ == "__main__":
    migrate_schema(engine, os.getenv("RAILWAY_DEPLOYMENT_ID"))
