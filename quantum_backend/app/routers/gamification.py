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
        # A lone H on |0⟩ creates the documented equal superposition. Requiring
        # the exact non-measurement circuit prevents a pass from unrelated gates.
        return submission.qubits >= 1 and len(gates) == 1 and gates[0].get("gate") == "H" and gates[0].get("target") == 0
    if mission_id == "build-bell-state":
        # H(q0) followed by CNOT(q0, q1) is the defined Bell-state preparation.
        return (
            submission.qubits >= 2 and len(gates) == 2
            and gates[0].get("gate") == "H" and gates[0].get("target") == 0
            and gates[1].get("gate") == "CNOT" and gates[1].get("control") == 0 and gates[1].get("target") == 1
        )
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
