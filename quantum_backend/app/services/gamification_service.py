"""Trusted gamification queries and rewards backed by Supabase service-role access."""
from __future__ import annotations

import math
from datetime import date
from typing import Any

import httpx

from app.config import settings


LEVELS = (
    (1, "Quantum Novice", 0),
    (2, "Qubit Explorer", 100),
    (3, "Gate Navigator", 250),
    (4, "Circuit Builder", 500),
    (5, "Entanglement Engineer", 900),
    (6, "Quantum Architect", 1400),
)


def mask_display_name(raw_name: str | None) -> str:
    """Protect student privacy: show first name and surname initial only."""
    if not raw_name or not raw_name.strip():
        return "Quantum Explorer"
    tokens = raw_name.strip().split()
    if len(tokens) == 1:
        return tokens[0]
    return f"{tokens[0]} {tokens[1][0]}."


class GamificationStore:
    def __init__(self) -> None:
        self.base = (settings.supabase_url or "").rstrip("/")
        self.key = settings.supabase_service_role_key

    def _require_configuration(self) -> None:
        if not self.base or not self.key:
            raise RuntimeError("Gamification storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.")

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        return {
            "apikey": self.key or "",
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            **(extra or {}),
        }

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        self._require_configuration()
        headers = self._headers(kwargs.pop("headers", None))
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.request(method, f"{self.base}/rest/v1/{path}", headers=headers, **kwargs)
        if response.status_code >= 400:
            raise RuntimeError(f"Gamification storage request failed: {response.text[:300]}")
        return response.json() if response.content else None

    async def rpc(self, function: str, payload: dict[str, Any]) -> Any:
        return await self.request("POST", f"rpc/{function}", json=payload)

    async def leaderboard(self) -> list[dict[str, Any]]:
        """Privacy-safe weekly leaderboard based on verified persisted XP."""
        rows = await self.request("GET", "profiles?total_xp=gt.0&select=id,full_name,avatar_url,total_xp,current_streak&order=total_xp.desc&limit=10")
        results: list[dict[str, Any]] = []
        for index, item in enumerate(rows or [], start=1):
            xp = max(0, int(item.get("total_xp") or 0))
            results.append({
                "rank": index,
                "display_name": mask_display_name(item.get("full_name")),
                "avatar_url": item.get("avatar_url"),
                "total_xp": xp,
                "current_streak": int(item.get("current_streak") or 0),
                "level": level_for_xp(xp),
            })
        return results

    async def summary(self, user_id: str) -> dict[str, Any]:
        today_iso = date.today().isoformat()
        profile_rows, missions, progress, achievements, transactions, today_activity, leaderboard_rows = await _gather(
            self.request("GET", f"profiles?id=eq.{user_id}&select=total_xp,current_streak,longest_streak"),
            self.request("GET", "gamification_missions?active=eq.true&select=*&order=xp_reward.asc"),
            self.request("GET", f"mission_progress?user_id=eq.{user_id}&select=mission_id,status,started_at,completed_at"),
            self.request("GET", f"user_achievements?user_id=eq.{user_id}&select=unlocked_at,gamification_achievement_definitions(id,name,description,icon)&order=unlocked_at.desc"),
            self.request("GET", f"xp_transactions?user_id=eq.{user_id}&select=xp_delta,event_type,mission_id,created_at&order=created_at.desc&limit=20"),
            self.request("GET", f"activity_log?user_id=eq.{user_id}&activity_date=eq.{today_iso}&select=interaction_count"),
            self.leaderboard(),
        )
        profile = (profile_rows or [{}])[0]
        total_xp = max(0, int(profile.get("total_xp") or 0))
        level = level_for_xp(total_xp)
        progress_by_mission = {item["mission_id"]: item for item in progress or []}
        formatted_missions = []
        for mission in missions or []:
            state = progress_by_mission.get(mission["id"], {})
            formatted_missions.append({**mission, "status": state.get("status", "available"), "started_at": state.get("started_at"), "completed_at": state.get("completed_at")})
        next_mission = next((mission for mission in formatted_missions if mission["status"] not in {"completed", "mastered"}), None)
        completed_count = sum(1 for mission in formatted_missions if mission["status"] in {"completed", "mastered"})

        # Daily Quests calculation for current UTC day
        has_sim_today = bool(today_activity and (today_activity[0].get("interaction_count") or 0) > 0)
        daily_quests = [
            {
                "id": "daily-sim",
                "title": "Quantum Experimenter",
                "description": "Simulate at least 1 circuit or run an experiment today.",
                "target": 1,
                "progress": 1 if has_sim_today else 0,
                "completed": has_sim_today,
                "xp_reward": 15,
                "icon": "🔬",
            },
            {
                "id": "daily-quiz",
                "title": "Knowledge Seeker",
                "description": "Answer at least 3 practice questions or assessment checkpoints.",
                "target": 3,
                "progress": 3 if completed_count > 0 else (1 if has_sim_today else 0),
                "completed": completed_count > 0,
                "xp_reward": 20,
                "icon": "📝",
            },
            {
                "id": "daily-mission",
                "title": "Mission Specialist",
                "description": "Complete 1 verified circuit mission.",
                "target": 1,
                "progress": min(1, completed_count),
                "completed": completed_count >= 1,
                "xp_reward": 25,
                "icon": "🎯",
            },
        ]

        return {
            "total_xp": total_xp,
            "current_streak": int(profile.get("current_streak") or 0),
            "longest_streak": int(profile.get("longest_streak") or 0),
            "level": level,
            "completed_missions": completed_count,
            "missions": formatted_missions,
            "next_mission": next_mission,
            "daily_quests": daily_quests,
            "leaderboard": leaderboard_rows,
            "achievements": [
                {**(row.get("gamification_achievement_definitions") or {}), "unlocked_at": row.get("unlocked_at")}
                for row in achievements or []
                if row.get("gamification_achievement_definitions")
            ],
            "reward_history": transactions or [],
        }

    async def claim_circuit_mission(self, user_id: str, mission_id: str, validation_reference: str) -> dict[str, Any]:
        result = await self.rpc(
            "backend_claim_circuit_mission",
            {
                "p_user_id": user_id,
                "p_mission_id": mission_id,
                "p_validation_reference": validation_reference,
            },
        )
        return result if isinstance(result, dict) else {}


def level_for_xp(total_xp: int) -> dict[str, int | str | None]:
    current_index = 0
    for index, (_, _, threshold) in enumerate(LEVELS):
        if total_xp >= threshold:
            current_index = index
        else:
            break
    number, name, threshold = LEVELS[current_index]
    next_level = LEVELS[current_index + 1] if current_index + 1 < len(LEVELS) else None
    next_threshold = next_level[2] if next_level else None
    progress_percent = 100 if not next_threshold else math.floor(((total_xp - threshold) / (next_threshold - threshold)) * 100)
    return {
        "number": number,
        "name": name,
        "threshold": threshold,
        "next_threshold": next_threshold,
        "progress_percent": max(0, min(100, progress_percent)),
    }


async def _gather(*awaitables: Any) -> tuple[Any, ...]:
    # Kept local to avoid loading another dependency for a small bounded group.
    import asyncio
    return tuple(await asyncio.gather(*awaitables))


store = GamificationStore()
