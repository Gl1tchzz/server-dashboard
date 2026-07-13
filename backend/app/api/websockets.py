import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from docker.errors import NotFound

from app.core.security import websocket_authorised
from app.services import deployments, docker_service, projects, system

router = APIRouter()


@router.websocket("/ws/dashboard")
async def dashboard_socket(websocket: WebSocket):
    if not websocket_authorised(websocket):
        await websocket.close(code=4401)
        return

    await websocket.accept()
    try:
        while True:
            project_list = []
            for project in projects.load_projects():
                project_list.append({
                    **project,
                    "container_statuses": docker_service.project_container_statuses(project),
                })

            await websocket.send_text(json.dumps({
                "host": system.snapshot(),
                "containers": docker_service.list_containers(),
                "projects": project_list,
            }))
            await asyncio.sleep(2)
    except (WebSocketDisconnect, RuntimeError):
        pass


@router.websocket("/ws/logs/{container_name}")
async def log_socket(websocket: WebSocket, container_name: str):
    if not websocket_authorised(websocket):
        await websocket.close(code=4401)
        return

    await websocket.accept()
    container = docker_service.get_container(container_name)
    if not container:
        await websocket.send_text("Container not found")
        await websocket.close()
        return

    try:
        loop = asyncio.get_running_loop()
        stream = container.logs(stream=True, follow=True, tail=250, timestamps=True)
        while True:
            line = await loop.run_in_executor(None, next, stream, None)
            if line is None:
                break
            await websocket.send_text(line.decode("utf-8", errors="replace").rstrip())
    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as exc:
        try:
            await websocket.send_text(f"Log error: {type(exc).__name__}: {exc}")
        except Exception:
            pass


@router.websocket("/ws/deployments/{deployment_id}")
async def deployment_socket(websocket: WebSocket, deployment_id: str):
    if not websocket_authorised(websocket):
        await websocket.close(code=4401)
        return

    await websocket.accept()
    position = 0

    try:
        while True:
            state = deployments.get_deployment(deployment_id)
            if not state:
                await websocket.send_text(json.dumps({"type": "error", "message": "Unknown deployment"}))
                return

            while position < len(state["lines"]):
                await websocket.send_text(json.dumps({
                    "type": "line",
                    "line": state["lines"][position],
                }))
                position += 1

            await websocket.send_text(json.dumps({
                "type": "status",
                "status": state["status"],
                "exit_code": state["exit_code"],
            }))

            if state["status"] in {"success", "failed"} and position >= len(state["lines"]):
                return

            await asyncio.sleep(0.5)
    except (WebSocketDisconnect, RuntimeError):
        pass
