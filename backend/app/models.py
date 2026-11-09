"""SQLAlchemy models for editable and published portfolios."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


PORTFOLIO_DOCUMENT = JSON(none_as_null=True).with_variant(
    JSONB(none_as_null=True), "postgresql"
)


class Portfolio(Base):
    """A stable URL with separate draft and published content."""

    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    draft_content: Mapped[dict[str, Any]] = mapped_column(PORTFOLIO_DOCUMENT)
    published_content: Mapped[dict[str, Any] | None] = mapped_column(PORTFOLIO_DOCUMENT)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuthChallenge(Base):
    __tablename__ = "auth_challenges"
    __table_args__ = (UniqueConstraint("email", "purpose"),)

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(254))
    purpose: Mapped[str] = mapped_column(String(24))
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    google_subject: Mapped[str | None] = mapped_column(String(255))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    code_hash: Mapped[str | None] = mapped_column(String(64))
    attempts_left: Mapped[int]
    expires_at: Mapped[int] = mapped_column(index=True)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[int] = mapped_column(index=True)


class AuthRateLimit(Base):
    __tablename__ = "auth_rate_limits"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    attempts: Mapped[int]
    expires_at: Mapped[int] = mapped_column(index=True)


class SchemaDeployment(Base):
    __tablename__ = "schema_deployments"

    deployment_id: Mapped[str] = mapped_column(String(128), primary_key=True)
