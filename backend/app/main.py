from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import paths
from app.routes import attach_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    paths.ensure_skill_and_data_dirs()
    from app.chat_store import prune_chat_sessions_startup

    prune_chat_sessions_startup()
    yield


app = FastAPI(title="Marketing Materials API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

attach_routes(app)


@app.get("/")
async def root():
    return {"message": "Marketing Materials API — use /api/health"}
