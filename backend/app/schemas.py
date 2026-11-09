"""Validate portfolio input and define the data exposed by the public page."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints


Slug = Annotated[
    str, StringConstraints(max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class PortfolioLink(BaseModel):
    label: Title
    url: HttpUrl


class PortfolioProject(BaseModel):
    title: Title
    description: str = Field(default="", max_length=4000)
    url: HttpUrl | None = None


class PortfolioContent(BaseModel):
    template_id: Slug
    name: Title
    headline: str = Field(default="", max_length=160)
    bio: str = Field(default="", max_length=4000)
    projects: list[PortfolioProject] = Field(default_factory=list, max_length=30)
    links: list[PortfolioLink] = Field(default_factory=list, max_length=20)


class PortfolioCreate(BaseModel):
    slug: Slug
    draft_content: PortfolioContent


class PortfolioUpdate(BaseModel):
    draft_content: PortfolioContent


class PublicPortfolio(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: Slug
    published_content: PortfolioContent
    published_at: datetime
