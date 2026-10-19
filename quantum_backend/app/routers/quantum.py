import time
import uuid
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.schemas import AlgorithmRequest, CircuitRequest
from app.security import require_configured_auth
from app.services.algorithms import run_bell, run_bernstein_vazirani, run_deutsch_jozsa, run_grover, run_phase_estimation, run_qft, run_shor
from app.services.qiskit_service import run_qiskit

router = APIRouter(prefix="/api/quantum", tags=["Quantum"], dependencies=[Depends(require_configured_auth)])
_results: dict[str, dict[str, Any]] = {}


def _prune_results(now: float | None = None) -> None:
    current_time = time.time() if now is None else now
    expiry = current_time - settings.result_cache_ttl_seconds
    for result_id, result in list(_results.items()):
        if result.get("completed_at", 0) < expiry:
            _results.pop(result_id, None)
    overflow = len(_results) - settings.max_cached_results
    if overflow > 0:
        oldest = sorted(_results, key=lambda result_id: _results[result_id].get("completed_at", 0))
        for result_id in oldest[:overflow]:
            _results.pop(result_id, None)


def _get_runner(framework: str) -> Callable[[str, int], Any]:
    if framework == "qiskit":
        return run_qiskit
    if framework == "pennylane":
        from app.services.pennylane_service import run_pennylane
        return run_pennylane
    if framework == "cirq":
        from app.services.cirq_service import run_cirq
        return run_cirq
    raise HTTPException(status_code=400, detail="Choose qiskit, pennylane, or cirq.")


def _run(request: CircuitRequest) -> dict[str, Any]:
    runner = _get_runner(request.framework)
    try:
        data = runner(request.code, request.shots)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="Quantum execution failed safely: " + str(error)) from error
    completed_at = time.time()
    _prune_results(completed_at)
    data["result_id"] = str(uuid.uuid4())
    _results[data["result_id"]] = {**data, "completed_at": completed_at}
    _prune_results(completed_at)
    return data


@router.post("/execute")
def execute(request: CircuitRequest): return _run(request)


@router.post("/circuit")
def circuit(request: CircuitRequest): return _run(request)


@router.post("/simulate")
def simulate(request: CircuitRequest): return _run(request)


@router.get("/result")
def result(result_id: str) -> dict[str, Any]:
    _prune_results()
    saved = _results.get(result_id)
    if not saved: raise HTTPException(status_code=404, detail="Execution result not found or expired.")
    return saved


@router.post("/algorithm")
def algorithm(request: AlgorithmRequest) -> dict[str, Any]:
    if request.framework != "qiskit": raise HTTPException(status_code=400, detail="Algorithms are currently implemented with Qiskit Aer only.")
    runners: dict[str, Callable[[int], Any]] = {"bell": run_bell, "deutsch_jozsa": run_deutsch_jozsa, "bernstein_vazirani": run_bernstein_vazirani, "grover": run_grover, "qft": run_qft, "phase_estimation": run_phase_estimation, "shor": run_shor}
    if request.algorithm not in runners: raise HTTPException(status_code=501, detail=f"{request.algorithm} is not implemented yet.")
    try:
        data = runners[request.algorithm](request.shots)
        counts = data.pop("counts", {})
        return {**data, "measurements": counts, "probabilities": {state: count / request.shots for state, count in counts.items()}, "explanation": f"Qiskit Aer executed {request.algorithm}.", "error": None}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
