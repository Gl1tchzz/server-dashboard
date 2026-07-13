from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.http import router as http_router
from app.api.websockets import router as websocket_router
from app.services.database import initialise

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="Nafiul Server Dashboard", docs_url="/api/docs")

app.include_router(http_router)
app.include_router(websocket_router)

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.on_event("startup")
async def startup():
    initialise()


@app.get("/{path:path}")
async def frontend(path: str):
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "Frontend has not been built"}
