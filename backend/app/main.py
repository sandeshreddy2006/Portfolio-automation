import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import router as auth_router
from app.db import engine
from app.migrate import migrate_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate_schema(engine, os.getenv("RAILWAY_DEPLOYMENT_ID"))
    yield


app = FastAPI(title="Portfolio Automation", lifespan=lifespan)
app.include_router(auth_router)


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
