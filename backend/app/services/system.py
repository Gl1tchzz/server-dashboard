import os
import shutil
import time
from pathlib import Path
import psutil
from app.core.config import HOST_PROC, HOST_ROOT, HOST_NAS

if HOST_PROC.exists():
    psutil.PROCFS_PATH = str(HOST_PROC)


def disk_usage(path: Path) -> dict:
    try:
        usage = shutil.disk_usage(path)
        return {
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "percent": round((usage.used / usage.total) * 100, 1) if usage.total else 0,
        }
    except OSError:
        return {"total": 0, "used": 0, "free": 0, "percent": 0}


def temperatures() -> dict:
    output = {}
    try:
        for group, readings in psutil.sensors_temperatures().items():
            output[group] = [
                {
                    "label": reading.label or group,
                    "current": reading.current,
                    "high": reading.high,
                    "critical": reading.critical,
                }
                for reading in readings
            ]
    except Exception:
        pass
    return output


def network_stats() -> dict:
    stats = psutil.net_io_counters()
    return {
        "bytes_sent": stats.bytes_sent,
        "bytes_recv": stats.bytes_recv,
        "packets_sent": stats.packets_sent,
        "packets_recv": stats.packets_recv,
        "errors_in": stats.errin,
        "errors_out": stats.errout,
    }


def snapshot() -> dict:
    memory = psutil.virtual_memory()
    swap = psutil.swap_memory()
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "cpu_count": psutil.cpu_count(),
        "load": [round(value, 2) for value in psutil.getloadavg()],
        "memory": {
            "total": memory.total,
            "used": memory.used,
            "available": memory.available,
            "percent": memory.percent,
        },
        "swap": {
            "total": swap.total,
            "used": swap.used,
            "percent": swap.percent,
        },
        "root_disk": disk_usage(HOST_ROOT),
        "nas_disk": disk_usage(HOST_NAS),
        "uptime_seconds": max(0, int(time.time() - psutil.boot_time())),
        "temperatures": temperatures(),
        "network": network_stats(),
        "timestamp": int(time.time()),
    }
