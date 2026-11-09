"""SQLAlchemy models for editable and published portfolios."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, String, func
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
