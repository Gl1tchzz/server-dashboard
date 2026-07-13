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


async def create(project: dict, source: str = "manual") -> dict[str, Any]:
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
        "source": source,
    }
    deployments[deployment_id] = state
    asyncio.create_task(_run(deployment_id, script, project))
    return state


async def _run(deployment_id: str, script: str, project: dict) -> None:
    async with deployment_lock:
        state = deployments[deployment_id]
        state["status"] = "running"
        state["started_at"] = int(time.time())
        add_event(
            "deployment",
            state["project_name"],
            "running",
            {"id": deployment_id, "source": state["source"]},
        )

        try:
            compose_dir = project.get("compose_dir") or ""
            cwd = Path(compose_dir) if compose_dir and Path(compose_dir).is_dir() else None
            process = await asyncio.create_subprocess_exec(
                script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=cwd,
                env={
                    **os.environ,
                    "DASHBOARD_PROJECT_ID": str(project.get("id", "")),
                    "DASHBOARD_PROJECT_NAME": str(project.get("name", project.get("id", ""))),
                    "DASHBOARD_PROJECT_BRANCH": str(project.get("branch", "main")),
                    "DASHBOARD_PROJECT_DIR": str(project.get("compose_dir", "")),
                    "DASHBOARD_PROJECT_REPOSITORY": str(project.get("repository", "")),
                },
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
