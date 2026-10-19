"""Authenticated gamification endpoints with server-side circuit verification."""
from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.schemas import CircuitMissionSubmission
from app.security import require_configured_auth
from app.services.contest_service import ops_to_qiskit
from app.services.gamification_service import store
from app.services.qiskit_service import run_qiskit

router = APIRouter(prefix="/api/gamification", tags=["Gamification"])


def _normalise_operations(operations: list[dict[str, Any]], qubits: int) -> list[dict[str, int | str | float]]:
    allowed = {"H", "X", "Y", "Z", "S", "T", "Rx", "Ry", "Rz", "CNOT", "CZ", "SWAP", "M"}
    if not 1 <= qubits <= 5:
        raise ValueError("Circuit challenges support between one and five qubits.")
    if len(operations) > 40:
        raise ValueError("Circuit challenges support at most 40 operations.")
    normalised: list[dict[str, int | str | float]] = []
    for op in operations:
        gate = op.get("gate")
        target = op.get("target")
        if gate not in allowed or not isinstance(target, int) or not 0 <= target < qubits:
            raise ValueError("The circuit contains an unsupported gate or invalid target qubit.")
        item: dict[str, int | str | float] = {"gate": gate, "target": target, "col": int(op.get("col", 0))}
        if gate in {"CNOT", "CZ", "SWAP"}:
            control = op.get("control")
            if not isinstance(control, int) or not 0 <= control < qubits or control == target:
                raise ValueError(f"{gate} requires a different in-range control qubit.")
            item["control"] = control
        if gate in {"Rx", "Ry", "Rz"}:
            angle = op.get("angle")
            if not isinstance(angle, (int, float)):
                raise ValueError(f"{gate} requires a numeric angle.")
            item["angle"] = float(angle)
        normalised.append(item)
    return sorted(normalised, key=lambda item: int(item["col"]))


def _valid_superposition(operations: list[dict[str, Any]], qubits: int) -> bool:
    meaningful = [op for op in operations if op["gate"] != "M"]
    return qubits == 1 and len(meaningful) == 1 and meaningful[0]["gate"] == "H" and meaningful[0]["target"] == 0


def _valid_bell_state(operations: list[dict[str, Any]], qubits: int) -> bool:
    meaningful = [op for op in operations if op["gate"] != "M"]
    if qubits != 2 or len(meaningful) != 2:
        return False
    first, second = meaningful
    return (
        first["gate"] == "H" and first["target"] == 0
        and second["gate"] == "CNOT" and second["control"] == 0 and second["target"] == 1
    )


def _validate_mission(mission_id: str, operations: list[dict[str, Any]], qubits: int) -> bool:
    validators = {
        "build-superposition": _valid_superposition,
        "build-bell-state": _valid_bell_state,
    }
    validator = validators.get(mission_id)
    if not validator:
        raise ValueError("This circuit mission is not supported by the validator.")
    return validator(operations, qubits)


def _simulation_matches_mission(mission_id: str, operations: list[dict[str, Any]], qubits: int) -> bool:
    """Use the established backend simulator; do not trust browser results."""
    result = run_qiskit(ops_to_qiskit(operations, qubits), 2048)
    probabilities = result.get("probabilities") or {}
    expected = (
        {"0": 0.5, "1": 0.5}
        if mission_id == "build-superposition"
        else {"00": 0.5, "11": 0.5}
    )
    tolerance = 0.08
    return all(abs(float(probabilities.get(state, 0)) - target) <= tolerance for state, target in expected.items()) and all(
        state in expected or float(value) <= tolerance for state, value in probabilities.items()
    )


@router.get("/summary")
async def get_summary(user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    try:
        return {"success": True, "summary": await store.summary(user["id"])}
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="Gamification data is temporarily unavailable.") from error


@router.post("/circuit-missions/{mission_id}/submit")
async def submit_circuit_mission(mission_id: str, request: CircuitMissionSubmission, user=Depends(require_configured_auth)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    try:
        operations = _normalise_operations(request.operations, request.qubits)
        if not _validate_mission(mission_id, operations, request.qubits):
            raise HTTPException(
                status_code=422,
                detail="This circuit does not yet meet the mission's success criteria. Review the gate sequence and try again.",
            )
        if not _simulation_matches_mission(mission_id, operations, request.qubits):
            raise HTTPException(
                status_code=422,
                detail="The backend simulation did not produce the expected result. Check the circuit and submit again.",
            )
        reference = hashlib.sha256(json.dumps({"mission": mission_id, "qubits": request.qubits, "operations": operations}, sort_keys=True).encode()).hexdigest()
        reward = await store.claim_circuit_mission(user["id"], mission_id, reference)
        return {"success": True, "reward": reward, "summary": await store.summary(user["id"])}
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="The mission reward could not be recorded. You can safely try again.") from error
