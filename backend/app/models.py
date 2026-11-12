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
    # Nullable only so the column can be added to an existing table; the API always sets it.
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    # Counts saves of the draft, so two tabs can't silently overwrite each other. NULL means 0.
    revision: Mapped[int | None]
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
    profile_content: Mapped[dict[str, Any] | None] = mapped_column(PORTFOLIO_DOCUMENT)
    resume_id: Mapped[str | None] = mapped_column(String(32))
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    @property
    def google_connected(self) -> bool:
        return self.google_subject is not None


class Upload(Base):
    """An image or résumé stored for a user, kept for quota limits and cleanup."""

    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(80), unique=True)
    size: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SlugHold(Base):
    """A recently deleted portfolio address that can't be claimed by someone else yet."""

    __tablename__ = "slug_holds"

    slug: Mapped[str] = mapped_column(String(64), primary_key=True)
    # Not a foreign key: the hold must outlive a deleted account.
    owner_id: Mapped[int | None]
    until: Mapped[int] = mapped_column(index=True)
    # Set when the portfolio was renamed: visitors of the old address are sent to the new one.
    redirect_to: Mapped[str | None] = mapped_column(String(64))


class Report(Base):
    """A visitor's report about a published portfolio."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), index=True)
    reason: Mapped[str] = mapped_column(String(24))
    details: Mapped[str] = mapped_column(String(1000))
    contact: Mapped[str | None] = mapped_column(String(254))
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
    profile_content: Mapped[dict[str, Any] | None] = mapped_column(PORTFOLIO_DOCUMENT)
    resume_id: Mapped[str | None] = mapped_column(String(32))
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
