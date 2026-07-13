from fastapi import APIRouter, Depends, HTTPException
from docker.errors import DockerException, NotFound

from app.core.security import require_token
from app.services import database, deployments, docker_service, projects, system

router = APIRouter(prefix="/api")


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
        return await deployments.create(project)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/deployments/{deployment_id}", dependencies=[Depends(require_token)])
async def deployment_status(deployment_id: str):
    state = deployments.get_deployment(deployment_id)
    if not state:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return state
