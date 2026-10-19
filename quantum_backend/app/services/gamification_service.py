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
    "build-ghz-state": {
        "title": "Assemble a 3-qubit GHZ state",
        "description": "Entangle q0, q1, and q2 into 1/√2(|000⟩ + |111⟩) with H followed by two CNOTs.",
        "xp_reward": 60,
        "estimated_minutes": 15,
        "route": "/circuit?mission=build-ghz-state",
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
        headers = self._headers()
        headers.update(kwargs.pop("headers", {}))
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.request(method, f"{settings.supabase_url.rstrip('/')}/rest/v1/{path}", headers=headers, **kwargs)
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
            "weekly_quests": self._weekly_quests(completed or []),
            "reward_history": self._reward_history(completed or []),
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

    @staticmethod
    def _weekly_quests(rewards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        week_rewards = [r for r in rewards if r.get("created_at", "") >= week_start.isoformat()]
        circuit_missions_this_week = len({r["event_key"] for r in week_rewards if r.get("event_type") == "circuit_mission"})
        distinct_days = len({str(r.get("created_at", ""))[:10] for r in week_rewards})
        return [
            {
                "id": "weekly-circuits", "quest_type": "complete_circuit_missions_weekly",
                "title": "Complete 2 circuit missions this week",
                "description": "Build and submit two distinct circuit missions.",
                "target_count": 2, "current_count": min(circuit_missions_this_week, 2),
                "completed": circuit_missions_this_week >= 2, "xp_reward": 40, "route": "/circuit",
            },
            {
                "id": "weekly-active-days", "quest_type": "active_days_weekly",
                "title": "Learn on 3 different days this week",
                "description": "Earn verified rewards on at least 3 distinct days.",
                "target_count": 3, "current_count": min(distinct_days, 3),
                "completed": distinct_days >= 3, "xp_reward": 50, "route": "/dashboard",
            },
        ]

    @staticmethod
    def _reward_history(rewards: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Return a recent reward history feed (most recent first, max 20)."""
        sorted_rewards = sorted(rewards, key=lambda r: r.get("created_at", ""), reverse=True)[:20]
        return [
            {
                "event_type": r.get("event_type", ""),
                "event_key": r.get("event_key", ""),
                "created_at": r.get("created_at", ""),
            }
            for r in sorted_rewards
        ]

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
    "bell-state": {"name": "Entanglement Pioneer", "desc": "Built a verified Bell state circuit.", "icon": "🔗"},
    "superposition-master": {"name": "Superposition Master", "desc": "Created a verified superposition circuit.", "icon": "🌊"},
    "streak-3": {"name": "Consistency Keeper", "desc": "Maintained a 3-day learning streak.", "icon": "🔥"},
    "streak-7": {"name": "Quantum Marathoner", "desc": "Maintained a 7-day learning streak.", "icon": "⭐"},
    "xp-500": {"name": "Half Millennium", "desc": "Reached 500 verified XP.", "icon": "🎖️"},
    "xp-1000": {"name": "Quantum Kilobyte", "desc": "Reached 1000 verified XP.", "icon": "🏅"},
    "all-missions": {"name": "Mission Complete", "desc": "Completed all available circuit missions.", "icon": "🎯"},
    "daily-quest-5": {"name": "Quest Apprentice", "desc": "Completed 5 daily quests.", "icon": "📋"},
}
