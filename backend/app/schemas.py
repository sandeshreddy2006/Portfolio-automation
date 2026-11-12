"""Validate portfolio input and define the data exposed by the public page."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, StringConstraints


Slug = Annotated[
    str, StringConstraints(max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class PortfolioLink(BaseModel):
    label: Title
    url: HttpUrl


class ImageFraming(BaseModel):
    x: float = Field(default=50, ge=0, le=100)
    y: float = Field(default=50, ge=0, le=100)
    zoom: float = Field(default=1, ge=1, le=3)
    filter: Literal["original", "monochrome", "warm", "cool", "vivid"] = "original"


class PortfolioProject(BaseModel):
    title: Title
    description: str = Field(default="", max_length=4000)
    url: HttpUrl | None = None
    # URL of an image uploaded through /api/uploads; checked against the owner in portfolios.py.
    image: str | None = Field(default=None, max_length=300)
    image_framing: ImageFraming | None = None


class PortfolioExperience(BaseModel):
    role: Title
    company: str = Field(default="", max_length=120)
    dates: str = Field(default="", max_length=100)
    description: str = Field(default="", max_length=4000)


class PortfolioCredential(BaseModel):
    title: Title
    issuer: str = Field(default="", max_length=120)
    date: str = Field(default="", max_length=100)
    url: HttpUrl | None = None


class ProfileContent(BaseModel):
    name: Title
    avatar: str | None = Field(default=None, max_length=300)
    avatar_framing: ImageFraming | None = None
    headline: str = Field(default="", max_length=160)
    bio: str = Field(default="", max_length=4000)
    projects: list[PortfolioProject] = Field(default_factory=list, max_length=30)
    experience: list[PortfolioExperience] = Field(default_factory=list, max_length=30)
    credentials: list[PortfolioCredential] = Field(default_factory=list, max_length=30)
    links: list[PortfolioLink] = Field(default_factory=list, max_length=20)


ResumeId = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{32}$")]


class ProfileDetails(BaseModel):
    content: ProfileContent
    email: EmailStr
    google_connected: bool
    resume_id: ResumeId | None = None


class PortfolioContent(ProfileContent):
    template_id: Slug
    search_visible: bool = False
    resume_id: ResumeId | None = None


class PortfolioCreate(BaseModel):
    slug: Slug
    draft_content: PortfolioContent


class PortfolioUpdate(BaseModel):
    draft_content: PortfolioContent
    # The revision this edit started from. If someone saved in between, the save is refused.
    base_revision: int | None = None


class PortfolioRename(BaseModel):
    slug: Slug


class PortfolioSummary(BaseModel):
    slug: Slug
    revision: int = 0
    template_id: str
    name: str
    published: bool
    has_unpublished_changes: bool
    published_at: datetime | None
    updated_at: datetime


class PortfolioDetail(PortfolioSummary):
    draft_content: PortfolioContent
    published_content: PortfolioContent | None


class PublicPortfolio(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: Slug
    published_content: PortfolioContent
    published_at: datetime


Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class RegisterAccount(BaseModel):
    name: Title
    email: EmailStr
    password: Password


class PasswordLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class VerifyAccountCode(BaseModel):
    code: str = Field(pattern=r"^[0-9]{6}$")


class SetAccountPassword(BaseModel):
    password: Password


class AccountDetails(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    google_connected: bool


class GoogleIdentity(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    email: EmailStr
    name: str = Field(max_length=120)


class ReportCreate(BaseModel):
    reason: Literal["spam", "impersonation", "harassment", "illegal", "other"]
    details: str = Field(default="", max_length=1000)
    contact: EmailStr | None = None


class AssistRequest(BaseModel):
    task: Literal["headline", "bio", "project"]
    text: str = Field(min_length=1, max_length=4000)
    name: str = Field(default="", max_length=120)
    title: str = Field(default="", max_length=120)
