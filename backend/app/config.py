import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'app.db'}")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))

APP_SECRET = os.getenv("APP_SECRET", JWT_SECRET)

DEFAULT_ADMIN_USERNAME = "Guosy"
DEFAULT_ADMIN_PASSWORD = "1234567890"

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

# SearXNG 联网搜索（阿里云同机部署默认 127.0.0.1:8888）
SEARXNG_BASE_URL = os.getenv("SEARXNG_BASE_URL", "http://127.0.0.1:8888")
SEARXNG_ENABLED = os.getenv("SEARXNG_ENABLED", "true").lower() in ("1", "true", "yes")
SEARXNG_MAX_RESULTS = int(os.getenv("SEARXNG_MAX_RESULTS", "5"))
SEARXNG_TIMEOUT_SEC = float(os.getenv("SEARXNG_TIMEOUT_SEC", "10"))
