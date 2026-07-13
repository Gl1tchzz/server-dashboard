import asyncio
import os
import time
import uuid
from pathlib import Path
from typing import Any
from app.services.database import add_event

deployments: dict[str, dict[str, Any]] = {}
deployment_lock = asyncio.Lock()


def get_deployment(deployment_id: str) -> dict[str, Any] | None:
    return deployments.get(deployment_id)


async def create(project: dict) -> dict[str, Any]:
    script = project.get("deploy_script")
    if not script:
        raise ValueError("No deployment script configured")
    if not Path(script).is_file():
        raise ValueError(f"Deployment script does not exist: {script}")

    deployment_id = str(uuid.uuid4())
    state = {
        "id": deployment_id,
        "project_id": project["id"],
        "project_name": project.get("name", project["id"]),
        "status": "queued",
        "started_at": None,
        "finished_at": None,
        "exit_code": None,
        "lines": [],
    }
    deployments[deployment_id] = state
    asyncio.create_task(_run(deployment_id, script))
    return state


async def _run(deployment_id: str, script: str) -> None:
    async with deployment_lock:
        state = deployments[deployment_id]
        state["status"] = "running"
        state["started_at"] = int(time.time())
        add_event("deployment", state["project_name"], "running", {"id": deployment_id})

        try:
            process = await asyncio.create_subprocess_exec(
                script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env={**os.environ},
            )
            assert process.stdout is not None

            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                state["lines"].append(line.decode("utf-8", errors="replace").rstrip())
                state["lines"] = state["lines"][-3000:]

            state["exit_code"] = await process.wait()
            state["status"] = "success" if state["exit_code"] == 0 else "failed"
        except Exception as exc:
            state["status"] = "failed"
            state["exit_code"] = -1
            state["lines"].append(f"{type(exc).__name__}: {exc}")
        finally:
            state["finished_at"] = int(time.time())
            add_event(
                "deployment",
                state["project_name"],
                state["status"],
                {"id": deployment_id, "exit_code": state["exit_code"]},
            )
