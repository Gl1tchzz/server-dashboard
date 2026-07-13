import hmac
from fastapi import Header, HTTPException, WebSocket
from .config import TOKEN


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not TOKEN:
        raise HTTPException(status_code=500, detail="DASHBOARD_TOKEN is not configured")

    supplied = authorization or ""
    if supplied.lower().startswith("bearer "):
        supplied = supplied[7:]

    if not hmac.compare_digest(supplied, TOKEN):
        raise HTTPException(status_code=401, detail="Invalid dashboard token")


def websocket_authorised(websocket: WebSocket) -> bool:
    supplied = websocket.query_params.get("token", "")
    return bool(TOKEN and hmac.compare_digest(supplied, TOKEN))
