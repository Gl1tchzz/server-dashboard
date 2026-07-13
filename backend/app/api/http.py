import hashlib
import hmac
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from docker.errors import DockerException, NotFound

from app.core.config import GITHUB_WEBHOOK_SECRET
from app.core.security import require_token
from app.services import database, deployments, docker_service, projects, system

router = APIRouter(prefix="/api")


def _normalise_repo(value: str | None) -> str:
    if not value:
        return ""
    cleaned = value.strip()
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    cleaned = cleaned.replace("git@github.com:", "https://github.com/")
    cleaned = cleaned.replace("http://", "https://")
    return cleaned.lower().rstrip("/")


def _project_matches_push(project: dict[str, Any], payload: dict[str, Any]) -> bool:
    ref = payload.get("ref", "")
    branch = ref.removeprefix("refs/heads/")
    if branch != project.get("branch", "main"):
        return False

    repository = payload.get("repository") or {}
    configured = _normalise_repo(project.get("repository"))
    candidates = {
        _normalise_repo(repository.get("html_url")),
        _normalise_repo(repository.get("clone_url")),
        _normalise_repo(repository.get("ssh_url")),
    }
    full_name = repository.get("full_name")
    if full_name:
        candidates.add(_normalise_repo(f"https://github.com/{full_name}"))
    return bool(configured and configured in candidates)


def _verify_github_signature(body: bytes, signature: str | None) -> None:
    if not GITHUB_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="GITHUB_WEBHOOK_SECRET is not configured")
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing GitHub webhook signature")

    digest = hmac.new(GITHUB_WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid GitHub webhook signature")


@router.get("/health")
async def health():
    return {"ok": True}


@router.get("/snapshot", dependencies=[Depends(require_token)])
async def dashboard_snapshot():
    project_list = []
    for project in projects.load_projects():
        project_list.append({
            **project,
            "container_statuses": docker_service.project_container_statuses(project),
        })

    return {
        "host": system.snapshot(),
        "containers": docker_service.list_containers(),
        "projects": project_list,
        "events": database.recent_events(25),
    }


@router.post("/containers/{name}/{action}", dependencies=[Depends(require_token)])
async def container_action(name: str, action: str):
    if action not in {"start", "stop", "restart"}:
        raise HTTPException(status_code=400, detail="Unsupported action")
    try:
        container = docker_service.control(name, action)
        database.add_event("container", name, action, {"container": container})
        return {"ok": True, "container": container}
    except NotFound:
        raise HTTPException(status_code=404, detail="Container not found")
    except (DockerException, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/projects/{project_id}/deploy", dependencies=[Depends(require_token)])
async def deploy(project_id: str):
    project = projects.get_project(project_id)
    try:
        return await deployments.create(project, source="manual")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/deployments/{deployment_id}", dependencies=[Depends(require_token)])
async def deployment_status(deployment_id: str):
    state = deployments.get_deployment(deployment_id)
    if not state:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return state


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    x_github_event: str | None = Header(default=None),
    x_hub_signature_256: str | None = Header(default=None),
):
    body = await request.body()
    _verify_github_signature(body, x_hub_signature_256)

    if x_github_event == "ping":
        return {"ok": True, "message": "Webhook connected"}
    if x_github_event != "push":
        return {"ok": True, "ignored": f"Unsupported event: {x_github_event}"}

    payload = await request.json()
    triggered = []
    skipped = []

    for project in projects.load_projects():
        if not _project_matches_push(project, payload):
            continue
        if project.get("auto_deploy", True) is False:
            skipped.append({"project_id": project.get("id"), "reason": "auto_deploy disabled"})
            continue
        try:
            deployment = await deployments.create(project, source="github webhook")
            triggered.append({
                "project_id": project.get("id"),
                "project_name": project.get("name", project.get("id")),
                "deployment_id": deployment["id"],
            })
        except ValueError as exc:
            skipped.append({"project_id": project.get("id"), "reason": str(exc)})

    status = "triggered" if triggered else "ignored"
    database.add_event("webhook", "GitHub push", status, {"triggered": triggered, "skipped": skipped})
    return {"ok": True, "triggered": triggered, "skipped": skipped}
