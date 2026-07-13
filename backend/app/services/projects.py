from typing import Any
import yaml
from fastapi import HTTPException
from app.core.config import PROJECTS_FILE


def load_projects() -> list[dict[str, Any]]:
    try:
        payload = yaml.safe_load(PROJECTS_FILE.read_text(encoding="utf-8")) or {}
        projects = payload.get("projects", [])
        return projects if isinstance(projects, list) else []
    except (OSError, yaml.YAMLError):
        return []


def get_project(project_id: str) -> dict[str, Any]:
    for project in load_projects():
        if project.get("id") == project_id:
            return project
    raise HTTPException(status_code=404, detail="Unknown project")
