from typing import Any
import docker
from docker.errors import DockerException, NotFound

client = docker.from_env()


def summary(container) -> dict[str, Any]:
    container.reload()
    labels = container.labels or {}
    state = container.attrs.get("State", {})
    return {
        "id": container.short_id,
        "name": container.name,
        "image": ", ".join(container.image.tags) or container.image.short_id,
        "status": container.status,
        "health": state.get("Health", {}).get("Status"),
        "restart_count": container.attrs.get("RestartCount", 0),
        "created": container.attrs.get("Created"),
        "project": labels.get("com.docker.compose.project", ""),
        "service": labels.get("com.docker.compose.service", ""),
        "ports": container.attrs.get("NetworkSettings", {}).get("Ports", {}),
    }


def list_containers() -> list[dict[str, Any]]:
    result = []
    for container in client.containers.list(all=True):
        try:
            result.append(summary(container))
        except DockerException:
            continue
    return sorted(result, key=lambda item: item["name"].lower())


def get_container(name: str):
    try:
        return client.containers.get(name)
    except NotFound:
        return None


def control(name: str, action: str) -> dict:
    container = get_container(name)
    if not container:
        raise NotFound("Container not found")
    if action == "start":
        container.start()
    elif action == "stop":
        container.stop(timeout=20)
    elif action == "restart":
        container.restart(timeout=20)
    else:
        raise ValueError("Unsupported action")
    return summary(container)


def project_container_statuses(project: dict) -> list[dict]:
    result = []
    for name in project.get("containers", []):
        container = get_container(name)
        result.append(summary(container) if container else {"name": name, "status": "not-created"})
    return result
