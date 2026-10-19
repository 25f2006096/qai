"""Contest persistence and scoring. Submitted programs always run through the existing AST compilers."""
from __future__ import annotations

import math
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.services.qiskit_service import compile_qiskit, run_qiskit


def _now() -> datetime:
    return datetime.now(timezone.utc)


def contest_status(contest: dict[str, Any]) -> str:
    now = _now()
    start = datetime.fromisoformat(str(contest["start_time"]).replace("Z", "+00:00"))
    end = datetime.fromisoformat(str(contest["end_time"]).replace("Z", "+00:00"))
    return "upcoming" if now < start else "ended" if now >= end else "live"


def ops_to_qiskit(ops: list[dict[str, Any]], qubits: int) -> str:
    """Convert structured circuit input into safe Qiskit source, then compile it through compile_qiskit."""
    if not isinstance(ops, list) or not 1 <= qubits <= 20:
        raise ValueError("A contest circuit requires between 1 and 20 qubits.")
    lines = ["from qiskit import QuantumCircuit", f"qc = QuantumCircuit({qubits})"]
    for op in sorted(ops, key=lambda item: int(item.get("col", 0))):
        gate, target = op.get("gate"), op.get("target")
        if not isinstance(target, int) or not 0 <= target < qubits:
            raise ValueError("Every gate must have an in-range integer target.")
        if gate in {"H", "X", "Y", "Z", "S", "T"}:
            lines.append(f"qc.{gate.lower()}({target})")
        elif gate in {"Rx", "Ry", "Rz"}:
            angle = op.get("angle", math.pi / 2)
            if not isinstance(angle, (int, float)):
                raise ValueError("Rotation angles must be numeric.")
            lines.append(f"qc.{gate.lower()}({float(angle)}, {target})")
        elif gate in {"CNOT", "CZ", "SWAP"}:
            control = op.get("control")
            if not isinstance(control, int) or not 0 <= control < qubits or control == target:
                raise ValueError(f"{gate} requires a different in-range control qubit.")
            method = {"CNOT": "cx", "CZ": "cz", "SWAP": "swap"}[gate]
            lines.append(f"qc.{method}({control}, {target})")
        elif gate != "M":
            raise ValueError(f"Unsupported contest gate: {gate}")
    lines.append("qc.measure_all()")
    return "\n".join(lines)


def _overlap(expected: dict[str, float], actual: dict[str, float]) -> float:
    return min(1.0, sum(math.sqrt(max(0, expected.get(state, 0)) * max(0, actual.get(state, 0))) for state in set(expected) | set(actual)) ** 2)


def _depth_and_gates(code: str, framework: str, fallback_gates: int = 0) -> tuple[int, int]:
    if framework == "qiskit":
        circuit = compile_qiskit(code)
        return len(circuit.data), circuit.depth() or 0
    # The non-Qiskit compilers rebuild and execute their own SDK circuit. Source line count
    # is deliberately only used for efficiency metadata; it is never executed or parsed anew.
    gates = sum(1 for line in code.splitlines() if "." in line and "return" not in line and "import" not in line)
    return fallback_gates or gates, fallback_gates or gates


def _execute(framework: str, code: str) -> dict[str, Any]:
    if framework == "qiskit":
        runner = run_qiskit
    elif framework == "pennylane":
        from app.services.pennylane_service import run_pennylane
        runner = run_pennylane
    elif framework == "cirq":
        from app.services.cirq_service import run_cirq
        runner = run_cirq
    else:
        raise ValueError("Choose qiskit, pennylane, or cirq.")
    return runner(code, 1024)


class ContestStore:
    """Supabase REST store. A service-role key stays backend-only and is never sent to clients."""
    def __init__(self):
        self.base = (settings.supabase_url or "").rstrip("/")
        self.key = settings.supabase_service_role_key

    def _headers(self):
        return {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}

    def _require_configuration(self):
        if not (self.base and self.key):
            raise RuntimeError("Contest storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.")

    async def _request(self, method: str, path: str, **kwargs):
        self._require_configuration()
        headers = {**self._headers(), **kwargs.pop("headers", {})}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.request(method, f"{self.base}/rest/v1/{path}", headers=headers, **kwargs)
        if response.status_code >= 400:
            raise RuntimeError(f"Contest storage request failed: {response.text}")
        return response.json() if response.content else None

    async def contests(self):
        return await self._request("GET", "contests?select=*&order=start_time.desc")

    async def contest(self, contest_id: str):
        rows = await self._request("GET", f"contests?id=eq.{contest_id}&select=*")
        return rows[0] if rows else None

    async def problems(self, contest_id: str, private: bool = False):
        fields = "*" if private else "id,contest_id,title,statement,contest_type,framework,qubit_budget,gate_budget,par_gates,par_depth,pass_threshold,order_index"
        return await self._request("GET", f"contest_problems?contest_id=eq.{contest_id}&select={fields}&order=order_index")

    async def problem(self, contest_id: str, problem_id: str, private: bool = False):
        rows = await self.problems(contest_id, private)
        return next((problem for problem in rows if problem["id"] == problem_id), None)

    async def add_submission(self, submission: dict[str, Any]):
        if submission["is_best_for_user"]:
            await self._request("PATCH", f"contest_submissions?problem_id=eq.{submission['problem_id']}&user_id=eq.{submission['user_id']}", json={"is_best_for_user": False})
        rows = await self._request("POST", "contest_submissions", json=submission, headers={**self._headers(), "Prefer": "return=representation"})
        return rows[0]

    async def submissions(self, problem_id: str, user_id: str):
        return await self._request("GET", f"contest_submissions?problem_id=eq.{problem_id}&user_id=eq.{user_id}&select=*&order=total_score.desc")

    async def update_submission(self, submission_id: str, values: dict[str, Any]):
        rows = await self._request(
            "PATCH", f"contest_submissions?id=eq.{submission_id}", json=values,
            headers={**self._headers(), "Prefer": "return=representation"},
        )
        return rows[0] if rows else None

    async def leaderboard(self, contest_id: str):
        problems = await self.problems(contest_id, private=True)
        ids = {item["id"] for item in problems}
        rows = await self._request("GET", "contest_submissions?select=*")
        totals: dict[str, dict[str, Any]] = {}
        for row in rows:
            if row["problem_id"] not in ids or not row.get("is_best_for_user"): continue
            entry = totals.setdefault(row["user_id"], {"user_id": row["user_id"], "display_name": "You" if row["user_id"] == "local-user" else "Participant", "total_score_sum": 0, "problems_solved": 0})
            entry["total_score_sum"] += float(row.get("total_score") or 0)
            entry["problems_solved"] += int(float(row.get("correctness_score") or 0) >= .95)
        return sorted(totals.values(), key=lambda item: (-item["total_score_sum"], -item["problems_solved"]))

    async def rating(self, user_id: str):
        rows = await self._request("GET", f"user_ratings?user_id=eq.{user_id}&select=*")
        return rows[0] if rows else {"user_id": user_id, "current_rating": 1200, "rating_history": [], "contests_participated": 0}

    async def is_admin(self, user_id: str | None) -> bool:
        if not user_id:
            return False
        rows = await self._request("GET", f"profiles?id=eq.{user_id}&select=role")
        return bool(rows and rows[0].get("role") == "admin")

    async def finalize_ratings(self, contest: dict[str, Any]):
        """Apply a small Elo-style change exactly once after a rated contest ends."""
        if contest.get("finalized_at"):
            raise ValueError("This contest's ratings have already been finalized.")
        board = await self.leaderboard(contest["id"])
        if not board:
            return {"participants": 0, "changes": []}
        ratings = [await self.rating(row["user_id"]) for row in board]
        mean_rating = sum(int(row["current_rating"]) for row in ratings) / len(ratings)
        changes = []
        for rank, (row, rating) in enumerate(zip(board, ratings), start=1):
            actual = 1.0 if len(board) == 1 else 1 - (rank - 1) / (len(board) - 1)
            expected = 1 / (1 + 10 ** ((mean_rating - int(rating["current_rating"])) / 400))
            delta = round(32 * (actual - expected))
            history = list(rating.get("rating_history") or [])
            history.append({"contest_id": contest["id"], "rating": int(rating["current_rating"]) + delta, "delta": delta, "at": _now().isoformat()})
            values = {"user_id": row["user_id"], "current_rating": int(rating["current_rating"]) + delta, "rating_history": history, "contests_participated": int(rating.get("contests_participated") or 0) + 1, "updated_at": _now().isoformat()}
            await self._request("POST", "user_ratings", json=values, headers={**self._headers(), "Prefer": "resolution=merge-duplicates"})
            changes.append({"user_id": row["user_id"], "delta": delta, "rating": values["current_rating"]})
        await self._request("PATCH", f"contests?id=eq.{contest['id']}", json={"finalized_at": _now().isoformat()})
        return {"participants": len(board), "changes": changes}


store = ContestStore()


async def score_submission(problem: dict[str, Any], user_id: str, request) -> dict[str, Any]:
    if request.submission_type == "ops":
        if problem["contest_type"] != "circuit_building" or not request.ops:
            raise ValueError("This problem requires a valid circuit submission.")
        if problem.get("gate_budget") and len([op for op in request.ops if op.get("gate") != "M"]) > problem["gate_budget"]:
            raise ValueError("Circuit exceeds the gate budget.")
        framework, code = "qiskit", ops_to_qiskit(request.ops, int(problem["qubit_budget"]))
    else:
        framework, code = request.framework, request.code
        if problem["contest_type"] != "coding" or not framework or not code:
            raise ValueError("This problem requires code in a supported framework.")
    result = _execute(framework, code)  # Existing restricted AST compiler is the only execution boundary.
    reference = _execute("qiskit", ops_to_qiskit(problem["reference_ops"], int(problem["qubit_budget"])))
    correctness = _overlap(reference["probabilities"], result["probabilities"])
    if request.submission_type == "ops":
        # Measurements are appended only for simulator execution; they do not
        # count against a circuit challenge's gate/depth budget.
        gates = len([op for op in request.ops or [] if op.get("gate") != "M"])
        depth = max((int(op.get("col", 0)) + 1 for op in request.ops or [] if op.get("gate") != "M"), default=0)
    else:
        gates, depth = _depth_and_gates(code, framework)
    par_gates, par_depth = int(problem.get("par_gates") or max(gates, 1)), int(problem.get("par_depth") or max(depth, 1))
    gate_efficiency = min(1.0, par_gates / max(gates, par_gates))
    depth_efficiency = min(1.0, par_depth / max(depth, par_depth))
    efficiency = (gate_efficiency + depth_efficiency) / 2
    passed = correctness >= float(problem.get("pass_threshold") or .95)
    total = .5 * correctness + .25 * efficiency if passed else 0.0
    previous = await store.submissions(problem["id"], user_id)
    previous_best = max((float(item.get("total_score") or 0) for item in previous), default=-1)
    submission = {
        "id": str(uuid.uuid4()), "problem_id": problem["id"], "user_id": user_id,
        "submission_type": request.submission_type, "submitted_code": code if request.submission_type == "code" else None,
        "submitted_ops": request.ops if request.submission_type == "ops" else None,
        "correctness_score": correctness, "efficiency_score": efficiency if passed else 0.0,
        "fidelity_score": 0.0, "total_score": total, "gates_used": gates, "depth_used": depth,
        "is_best_for_user": total > previous_best, "submitted_at": _now().isoformat(),
    }
    return await store.add_submission(submission)


async def queue_hardware_fidelity(submission: dict[str, Any], problem: dict[str, Any]) -> None:
    """Queue one real-QPU job for a user's current best passing submission.

    The job is deliberately asynchronous: a request never waits for a physical
    device queue.  The stored status lets the UI report progress without
    exposing IBM credentials to the browser.
    """
    try:
        from app.services.ibm_service import get_job, submit_circuit
        code = submission.get("submitted_code") or ops_to_qiskit(submission["submitted_ops"], int(problem["qubit_budget"]))
        job = await asyncio.to_thread(submit_circuit, code=code, shots=1024)
        await store.update_submission(submission["id"], {"fidelity_status": "queued", "fidelity_job_id": job["job_id"]})
        # Keep this bounded: real devices can have long queues, so a later
        # request can still report the stored queued job rather than tying up a
        # web worker indefinitely.  Jobs that finish during this window update
        # the score from measured, not simulated, output.
        for _ in range(30):
            await asyncio.sleep(10)
            result = await asyncio.to_thread(get_job, job["job_id"])
            status = str(result.get("status", "")).upper()
            if status in {"DONE", "COMPLETED"}:
                counts = result.get("counts") or {}
                shots = max(sum(counts.values()), 1)
                observed = {state: value / shots for state, value in counts.items()}
                reference = _execute("qiskit", ops_to_qiskit(problem["reference_ops"], int(problem["qubit_budget"])))
                fidelity = _overlap(reference["probabilities"], observed)
                total = .5 * float(submission["correctness_score"]) + .25 * float(submission["efficiency_score"]) + .25 * fidelity
                await store.update_submission(submission["id"], {"fidelity_status": "complete", "fidelity_score": fidelity, "total_score": total})
                return
            if status in {"ERROR", "CANCELLED", "FAILED"}:
                await store.update_submission(submission["id"], {"fidelity_status": "failed", "fidelity_error": status})
                return
    except Exception as error:  # A missing IBM setup must not discard a valid local score.
        await store.update_submission(submission["id"], {"fidelity_status": "unavailable", "fidelity_error": str(error)[:300]})
