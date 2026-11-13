"""Bundle an already published Portfolabs template as a standalone static site."""

import re
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import requests
from fastapi import HTTPException

from app import media
from app.google_oauth import frontend_origin

STATIC_PATH = re.compile(r"/_next/static/[a-zA-Z0-9_./~-]+")
CSS_URL = re.compile(r"""url\(\s*(['"]?)([^)'"]+)\1\s*\)""")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
BLOCKED = {"script", "iframe", "object", "embed", "form", "template", "link", "base", "meta"}
MAX_ASSETS = 80
MAX_BYTES = 36 * 1024 * 1024


def static_path(path: str) -> bool:
    return bool(STATIC_PATH.fullmatch(path)) and not {".", ".."}.intersection(path.split("/"))


def export_path(path: str) -> str:
    return "/assets/theme/" + path.removeprefix("/_next/static/")


def fetch_asset(path: str, max_bytes: int, *, html: bool = False) -> bytes:
    try:
        with requests.get(
            frontend_origin() + path, timeout=(5, 12), allow_redirects=False, stream=True,
            headers={"User-Agent": "Twitterbot"} if html else {},
        ) as response:
            if response.status_code != 200:
                raise HTTPException(502, "Couldn’t read the published template from Portfolabs.")
            chunks = bytearray()
            for chunk in response.iter_content(65536):
                chunks.extend(chunk)
                if len(chunks) > max_bytes:
                    raise HTTPException(413, "This portfolio is too large to export.")
            return bytes(chunks)
    except requests.RequestException as error:
        raise HTTPException(502, "Couldn’t read the published template from Portfolabs.") from error


class TemplateMarkup(HTMLParser):
    def __init__(self, images: dict[str, str]):
        super().__init__(convert_charrefs=False)
        self.images = images
        self.parts: list[str] = []
        self.stylesheets: list[str] = []
        self.version: str | None = None
        self.div_depth = 0
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "link" and attributes.get("rel") == "stylesheet":
            href = urlsplit(attributes.get("href") or "")
            if not href.netloc and not href.scheme and static_path(href.path) and href.path.endswith(".css"):
                self.stylesheets.append(href.path)
        if self.div_depth == 0:
            if tag == "div" and self.version is None and attributes.get("data-portfolio-export"):
                self.version = attributes["data-portfolio-export"]
                self.div_depth = 1
            return

        if self.blocked or tag in BLOCKED:
            if tag not in VOID:
                self.blocked += 1
            return
        if tag == "div":
            self.div_depth += 1
        safe_attrs = []
        for name, value in attrs:
            if name.startswith("on") or name in {"srcset", "ping", "srcdoc"}:
                continue
            if name == "src":
                value = self.images.get(value or "")
                if value is None:
                    continue
            if name == "href" and value:
                if value.startswith("/") and not value.startswith("//"):
                    value = frontend_origin() + value
                if not value.startswith("#") and urlsplit(value).scheme not in {"https", "http"}:
                    continue
            safe_attrs.append(f" {name}" if value is None else f' {name}="{escape(value, quote=True)}"')
        self.parts.append(f"<{tag}{''.join(safe_attrs)}>")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if not self.div_depth:
            return
        if self.blocked:
            self.blocked -= 1
            return
        if tag == "div":
            self.div_depth -= 1
            if self.div_depth == 0:
                return
        self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if self.div_depth and not self.blocked:
            self.parts.append(data)

    def handle_entityref(self, name):
        self.handle_data(f"&{name};")

    def handle_charref(self, name):
        self.handle_data(f"&#{name};")


def utc(stamp: datetime) -> datetime:
    return stamp.astimezone(timezone.utc) if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)


def export_files(slug: str, user_id: int, content: dict, published_at: datetime) -> dict[str, bytes]:
    keys = media.image_keys(user_id, content)
    image_urls = {f"/media/{key}": f"/assets/{key.rsplit('/', 1)[1]}" for key in keys}
    markup = TemplateMarkup(image_urls)
    markup.feed(fetch_asset(f"/p/{slug}", 4 * 1024 * 1024, html=True).decode("utf-8"))
    try:
        rendered_at = utc(datetime.fromisoformat(markup.version or ""))
    except ValueError:
        rendered_at = None
    if not markup.parts or markup.div_depth or not markup.stylesheets or rendered_at != utc(published_at):
        raise HTTPException(409, "The published page changed or wasn’t ready to export. Try deploying again.")

    files: dict[str, bytes] = {}
    total = 0

    def add(path: str, data: bytes):
        nonlocal total
        total += len(data)
        if len(files) >= MAX_ASSETS or total > MAX_BYTES:
            raise HTTPException(413, "This portfolio is too large to export. Try using fewer images.")
        files[path.lstrip("/")] = data

    for key in sorted(keys):
        try:
            add(image_urls[f"/media/{key}"], media.read_media(key))
        except FileNotFoundError as error:
            raise HTTPException(409, "A published image is missing. Check the portfolio and publish again.") from error

    def include_style(path: str):
        if export_path(path).lstrip("/") in files:
            return
        css = fetch_asset(path, 2 * 1024 * 1024).decode("utf-8")

        def copy_asset(match):
            referenced = match[2].strip()
            parsed = urlsplit(urljoin(path, referenced))
            if parsed.scheme or parsed.netloc or not static_path(parsed.path):
                return match[0]
            resolved = parsed.path
            if export_path(resolved).lstrip("/") not in files:
                add(export_path(resolved), fetch_asset(resolved, 4 * 1024 * 1024))
            return f'url("{export_path(resolved)}")'

        add(export_path(path), CSS_URL.sub(copy_asset, css).encode())

    for path in dict.fromkeys(markup.stylesheets):
        include_style(path)

    title = escape(content["name"])
    description = escape(content.get("headline") or f"{content['name']}’s portfolio", quote=True)
    robots = "index,follow" if content.get("search_visible") else "noindex,nofollow"
    styles = "".join(f'<link rel="stylesheet" href="{export_path(path)}">' for path in dict.fromkeys(markup.stylesheets))
    add("index.html", (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
        f'<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<meta name="description" content="{description}"><meta name="robots" content="{robots}">'
        f'<title>{title} | Portfolio</title>{styles}</head><body>{"".join(markup.parts)}</body></html>'
    ).encode())
    # Disable scripts in exported sites and allow serving the bundled Next stylesheet and font files.
    add("vercel.json", b'{"framework":null,"headers":[{"source":"/(.*)","headers":[{"key":"Content-Security-Policy","value":"default-src \'self\'; script-src \'none\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; font-src \'self\'; object-src \'none\'; base-uri \'none\'"}]}]}')
    return files
