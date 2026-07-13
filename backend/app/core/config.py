import os
from pathlib import Path

TOKEN = os.getenv("DASHBOARD_TOKEN", "")
GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
PROJECTS_FILE = Path(os.getenv("PROJECTS_FILE", "/app/config/projects.yaml"))
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", "/app/data/dashboard.db"))
HOST_PROC = Path(os.getenv("HOST_PROC", "/host/proc"))
HOST_SYS = Path(os.getenv("HOST_SYS", "/host/sys"))
HOST_ROOT = Path(os.getenv("HOST_ROOT", "/host/root"))
HOST_NAS = Path(os.getenv("HOST_NAS", "/host/nas"))
