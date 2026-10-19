"""Persistent notification storage and retrieval.

Notifications are created for meaningful events (achievements, level-ups, quest
completions) and stored in Supabase for cross-device access. The frontend reads
them through the gamification summary and this dedicated API.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


class NotificationStore:
    def _headers(self) -> dict[str, str]:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("Notification storage is not configured.")
        key = settings.supabase_service_role_key
        return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}

    async def _request(self, method: str, path: str, **kwargs):
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.request(method, f"{settings.supabase_url.rstrip('/')}/rest/v1/{path}", headers=self._headers(), **kwargs)
        if response.status_code >= 400:
            raise RuntimeError("Notification storage request failed.")
        return response.json() if response.content else None

    async def list_for_user(self, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        """Return recent notifications for a user, most recent first."""
        try:
            rows = await self._request("GET", f"notifications?user_id=eq.{user_id}&order=created_at.desc&limit={limit}")
            return rows or []
        except RuntimeError:
            return []

    async def create(self, user_id: str, category: str, title: str, body: str, route: str | None = None) -> dict[str, Any] | None:
        """Insert a notification row. Returns the created record or None."""
        try:
            rows = await self._request("POST", "notifications", json={
                "user_id": user_id,
                "category": category,
                "title": title,
                "body": body,
                "route": route or "",
            })
            return rows[0] if rows else None
        except RuntimeError:
            return None

    async def mark_read(self, user_id: str, notification_id: str) -> bool:
        """Mark a single notification as read for the given user."""
        try:
            await self._request("PATCH", f"notifications?id=eq.{notification_id}&user_id=eq.{user_id}",
                                json={"read": True})
            return True
        except RuntimeError:
            return False

    async def mark_all_read(self, user_id: str) -> bool:
        """Mark all of a user's notifications as read."""
        try:
            await self._request("PATCH", f"notifications?user_id=eq.{user_id}&read=eq.false",
                                json={"read": True})
            return True
        except RuntimeError:
            return False


notification_store = NotificationStore()
