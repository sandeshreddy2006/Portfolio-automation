from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import engine
from app.models import Portfolio


@asynccontextmanager
async def lifespan(app: FastAPI):
    Portfolio.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Portfolio Automation", lifespan=lifespan)


@app.get("/api/repo")
def get_repository_info() -> dict[str, str]:
    return {
        "name": "Portfolio Automation",
        "description": "Choose a template, add your details, and publish a portfolio you can share.",
        "repository_url": "https://github.com/sandeshreddy2006/Portfolio-automation",
    }
