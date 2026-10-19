from fastapi import APIRouter, Depends, HTTPException

from app.schemas import CircuitMissionSubmission
from app.security import require_configured_auth
from app.services.gamification_service import MISSIONS, store

router = APIRouter(prefix="/api/gamification", tags=["Gamification"])


def _ordered_gates(operations: list[dict]) -> list[dict]:
    return sorted((op for op in operations if op.get("gate") != "M"), key=lambda op: int(op.get("col", 0)))


def _matches_mission(mission_id: str, submission: CircuitMissionSubmission) -> bool:
    gates = _ordered_gates(submission.operations)
    if mission_id == "build-superposition":
        return submission.qubits >= 1 and any(op.get("gate") == "H" and op.get("target") == 0 for op in gates)
    if mission_id == "build-bell-state":
        has_h = any(op.get("gate") == "H" and op.get("target") == 0 for op in gates)
        has_cnot = any(op.get("gate") == "CNOT" and op.get("control") == 0 and op.get("target") == 1 for op in gates)
        return submission.qubits >= 2 and has_h and has_cnot
    return False


@router.get("/summary")
async def summary(user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required for gamification.")
    try:
        return {"success": True, "summary": await store.summary(user["id"])}
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error


@router.get("/leaderboard/weekly")
async def weekly_leaderboard(user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required for the learning leaderboard.")
    try:
        return {"success": True, "leaderboard": await store.weekly_leaderboard(user["id"])}
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error


@router.post("/circuit-missions/{mission_id}/submit")
async def submit_circuit_mission(mission_id: str, submission: CircuitMissionSubmission, user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(401, "Authentication is required for mission rewards.")
    if mission_id not in MISSIONS:
        raise HTTPException(404, "Circuit mission not found.")
    if not _matches_mission(mission_id, submission):
        raise HTTPException(400, "The circuit does not yet satisfy this mission's verified requirements.")
    try:
        reward = await store.award(user["id"], "circuit_mission", mission_id)
        return {"success": True, "reward": reward}
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error
