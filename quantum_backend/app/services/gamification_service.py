"""Server-side, idempotent reward persistence for verified learning events."""
from __future__ import annotations

import math
from typing import Any

import httpx

from app.config import settings


MISSIONS: dict[str, dict[str, Any]] = {
    "build-superposition": {
        "title": "Create a superposition",
        "description": "Apply a Hadamard gate to q0 and simulate the circuit.",
        "xp_reward": 30,
        "estimated_minutes": 5,
        "route": "/circuit?mission=build-superposition",
    },
    "build-bell-state": {
        "title": "Build a Bell state",
        "description": "Entangle q0 and q1 with H followed by CNOT, then simulate it.",
        "xp_reward": 50,
        "estimated_minutes": 10,
        "route": "/circuit?mission=build-bell-state",
    },
}

RANKS = (
    "Quantum Initiate",
    "Qubit Explorer",
    "Superposition Specialist",
    "Quantum Gate Engineer",
    "Entanglement Researcher",
    "Circuit Architect",
    "Quantum Algorithm Master",
    "Quantum Pioneer",
)


def level_for_xp(total_xp: int) -> dict[str, Any]:
    number = math.floor(math.sqrt(max(0, total_xp) / 100)) + 1
    current_floor = (number - 1) ** 2 * 100
    next_threshold = number ** 2 * 100
    return {
        "number": number,
        "name": RANKS[min(number - 1, len(RANKS) - 1)],
        "label": f"Level {number}",
        "progress_percent": min(100, round((total_xp - current_floor) / (next_threshold - current_floor) * 100)),
        "next_threshold": next_threshold,
    }


class GamificationStore:
    def _headers(self) -> dict[str, str]:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("Gamification storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.")
        key = settings.supabase_service_role_key
        return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    async def _request(self, method: str, path: str, **kwargs):
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.request(method, f"{settings.supabase_url.rstrip('/')}/rest/v1/{path}", headers=self._headers(), **kwargs)
        if response.status_code >= 400:
            raise RuntimeError("Gamification storage request failed.")
        return response.json() if response.content else None

    async def summary(self, user_id: str) -> dict[str, Any]:
        profiles = await self._request("GET", f"profiles?id=eq.{user_id}&select=total_xp,current_streak,longest_streak")
        profile = profiles[0] if profiles else {}
        completed = await self._request("GET", f"gamification_rewards?user_id=eq.{user_id}&select=event_key,event_type,created_at")
        completed_keys = {row["event_key"] for row in completed or []}
        achievements = await self._request("GET", f"gamification_achievements?user_id=eq.{user_id}&select=achievement_id,unlocked_at&order=unlocked_at.desc")
        missions = [
            {"id": mission_id, **mission, "status": "completed" if mission_id in completed_keys else "available"}
            for mission_id, mission in MISSIONS.items()
        ]
        total_xp = int(profile.get("total_xp") or 0)
        return {
            "total_xp": total_xp,
            "current_streak": int(profile.get("current_streak") or 0),
            "longest_streak": int(profile.get("longest_streak") or 0),
            "level": level_for_xp(total_xp),
            "missions": missions,
            "next_mission": next((mission for mission in missions if mission["status"] != "completed"), None),
            "achievements": [ACHIEVEMENTS[row["achievement_id"]] | {"id": row["achievement_id"], "unlocked_at": row["unlocked_at"]} for row in achievements or [] if row["achievement_id"] in ACHIEVEMENTS],
            "daily_quests": self._daily_quests(completed or []),
        }

    async def weekly_leaderboard(self, user_id: str) -> dict[str, Any]:
        """Return only the privacy-safe fields produced by the server-side RPC.

        Aggregation is deliberately performed in Postgres rather than in the
        browser so clients cannot choose their own XP totals or rank.
        """
        rows = await self._request("POST", "rpc/learning_weekly_leaderboard", json={"p_viewer_id": user_id})
        rows = rows or []
        return {"metric": "verified XP earned this UTC week", "period": "week", "entries": rows[:20]}

    @staticmethod
    def _daily_quests(rewards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date().isoformat()
        today_keys = {row["event_key"] for row in rewards if str(row.get("created_at", "")).startswith(today)}
        return [{
            "id": "daily-circuit", "quest_type": "complete_circuit_mission", "title": "Complete a verified circuit mission",
            "description": "Build and submit a verified circuit objective.", "target_count": 1,
            "current_count": 1 if f"daily:circuit:{today}" in today_keys else 0,
            "completed": f"daily:circuit:{today}" in today_keys, "xp_reward": 20, "route": "/circuit",
        }]

    async def award(self, user_id: str, event_type: str, event_key: str) -> dict[str, Any]:
        # The SQL function owns reward amounts and the uniqueness constraint. The
        # browser never supplies an XP value.
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.post(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/award_gamification_reward",
                headers=self._headers(),
                json={"p_user_id": user_id, "p_event_type": event_type, "p_event_key": event_key},
            )
        if response.status_code >= 400:
            raise RuntimeError("The reward could not be recorded. Confirm that migration 15_gamification.sql has been applied.")
        return response.json()


store = GamificationStore()

ACHIEVEMENTS = {
    "first-circuit": {"name": "Circuit Explorer", "desc": "Completed your first verified circuit mission.", "icon": "⚛️"},
    "first-contest": {"name": "Quantum Competitor", "desc": "Earned a reward from a qualifying contest solution.", "icon": "🏁"},
    "xp-100": {"name": "Century of Discovery", "desc": "Reached 100 verified XP.", "icon": "💯"},
}
