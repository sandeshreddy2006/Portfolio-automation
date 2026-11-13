"""Apply additive schema changes and remove expired operational records.

Schema reconciliation preserves tables, columns, and their data. Cleanup only
targets known temporary records and legacy holds left by deleted accounts.
"""

import logging
import os
import time

from sqlalchemy import Connection, Engine, Table, delete, inspect, or_, select

from app.db import Base, engine
from app.models import AuthChallenge, AuthRateLimit, AuthSession, SchemaDeployment, SlugHold, User, VercelInstallState

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


def cleanup_stale_records(connection: Connection, now: int) -> None:
    expiring = (AuthChallenge, AuthSession, AuthRateLimit, VercelInstallState)
    for model in expiring:
        result = connection.execute(delete(model).where(model.expires_at <= now))
        if result.rowcount:
            logger.info("Removed %d expired rows from %s", result.rowcount, model.__tablename__)

    # Older account deletion left ownerless holds. Single-portfolio deletion
    # still reserves the address for a live owner, and rename redirects still work.
    owner_exists = select(User.id).where(User.id == SlugHold.owner_id).exists()
    result = connection.execute(delete(SlugHold).where(or_(
        SlugHold.until <= now,
        SlugHold.redirect_to.is_(None) & ~owner_exists,
    )))
    if result.rowcount:
        logger.info("Removed %d expired or orphaned address holds", result.rowcount)


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

    cleanup_stale_records(connection, int(time.time()))

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
