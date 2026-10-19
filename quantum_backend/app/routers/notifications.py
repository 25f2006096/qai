from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.security import require_configured_auth
from app.services.notification_service import notification_store

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class MarkReadRequest(BaseModel):
    notification_id: str | None = None
    all: bool = False


@router.get("")
async def list_notifications(user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required.")
    try:
        notifications = await notification_store.list_for_user(user["id"])
        unread_count = sum(1 for n in notifications if not n.get("read"))
        return {"success": True, "notifications": notifications, "unread_count": unread_count}
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error


@router.post("/read")
async def mark_read(request: MarkReadRequest, user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required.")
    try:
        if request.all:
            ok = await notification_store.mark_all_read(user["id"])
        elif request.notification_id:
            ok = await notification_store.mark_read(user["id"], request.notification_id)
        else:
            raise HTTPException(400, "Provide notification_id or set all=true.")
        return {"success": ok}
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error
