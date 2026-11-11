import mimetypes
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.auth import router as auth_router
from app.db import engine
from app.media import LOCAL_DIR, local_development, r2_configured
from app.ai import router as ai_router
from app.migrate import migrate_schema
from app.portfolios import router as portfolios_router
from app.reports import router as reports_router
from app.uploads import router as uploads_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate_schema(engine, os.getenv("RAILWAY_DEPLOYMENT_ID"))
    yield


app = FastAPI(title="Portfolio Automation", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(portfolios_router)
app.include_router(uploads_router)
app.include_router(reports_router)
app.include_router(ai_router)

if local_development() and not r2_configured():
    # Development only: serve uploaded images from disk. Production uses Cloudflare R2.
    mimetypes.add_type("image/webp", ".webp")  # not registered on every OS
    LOCAL_DIR.mkdir(exist_ok=True)
    app.mount("/media", StaticFiles(directory=LOCAL_DIR), name="media")


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, error: RequestValidationError):
    if request.url.path.startswith("/api/auth/"):
        return JSONResponse({"detail": "Check the information you entered and try again."}, status_code=422)
    return await request_validation_exception_handler(request, error)

frontend_url = os.getenv("FRONTEND_URL") or "http://localhost:3000"
frontend_origins = [
    origin.strip().rstrip("/")
    for origin in frontend_url.split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/repo")
def get_repository_info() -> dict[str, str]:
    return {
        "name": "Portfolio Automation",
        "description": "Choose a template, add your details, and publish a portfolio you can share.",
        "repository_url": "https://github.com/sandeshreddy2006/Portfolio-automation",
    }
