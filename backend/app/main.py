import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import engine
from app.models import Portfolio


@asynccontextmanager
async def lifespan(app: FastAPI):
    Portfolio.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Portfolio Automation", lifespan=lifespan)

default_frontend_url = "" if os.getenv("RAILWAY_ENVIRONMENT_ID") else "http://localhost:3000"
frontend_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_URL", default_frontend_url).split(",")
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
