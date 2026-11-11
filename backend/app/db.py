"""Database engine and request-scoped SQLAlchemy sessions."""

import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, event, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

configured_url = os.getenv("DATABASE_URL")
database_url = (
    make_url(configured_url)
    if configured_url
    else URL.create("sqlite", database=str(BACKEND_DIR / "portfolio.db"))
)

if database_url.get_backend_name() == "sqlite" and database_url.database not in (None, "", ":memory:"):
    # A relative path (like the one in .env.example) means "next to the backend", wherever
    # the command is run from. Otherwise each folder would quietly get its own database.
    database_url = database_url.set(database=str((BACKEND_DIR / database_url.database).resolve()))

if database_url.drivername in {"postgres", "postgresql"}:
    database_url = database_url.set(drivername="postgresql+psycopg")

connect_args = {}
if database_url.get_backend_name() == "sqlite":
    connect_args["check_same_thread"] = False

engine = create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)


if database_url.get_backend_name() == "sqlite":
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys = ON")


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=engine, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a session and close it when the request finishes."""
    with SessionLocal() as session:
        yield session
