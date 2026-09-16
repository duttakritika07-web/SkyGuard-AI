"""Project-wide settings for the SkyGuard AI prototype."""

from __future__ import annotations

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATABASE_PATH = BASE_DIR / "skyguard.db"
DATABASE_URL = os.getenv(
    "SKYGUARD_DATABASE_URL",
    f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}",
)

MODEL_RANDOM_STATE = 42
HISTORY_SIZE = 16
SPATIAL_WINDOW_MINUTES = 15

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def cors_origins() -> list[str]:
    """Read an optional comma-separated frontend origin list."""

    configured = os.getenv("SKYGUARD_CORS_ORIGINS", "").strip()
    if not configured:
        return DEFAULT_CORS_ORIGINS
    return [origin.strip() for origin in configured.split(",") if origin.strip()]
