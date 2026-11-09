"""Database engine and request-scoped SQLAlchemy sessions."""

import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

configured_url = os.getenv("DATABASE_URL")
database_url = (
    make_url(configured_url)
    if configured_url
    else URL.create("sqlite", database=str(BACKEND_DIR / "portfolio.db"))
)

if database_url.drivername in {"postgres", "postgresql"}:
    database_url = database_url.set(drivername="postgresql+psycopg")

if os.getenv("RAILWAY_ENVIRONMENT_ID") and database_url.get_backend_name() != "postgresql":
    raise RuntimeError("Set DATABASE_URL to the Railway PostgreSQL connection URL.")

connect_args = {}
if database_url.get_backend_name() == "sqlite":
    connect_args["check_same_thread"] = False

engine = create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=engine, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a session and close it when the request finishes."""
    with SessionLocal() as session:
        yield session
