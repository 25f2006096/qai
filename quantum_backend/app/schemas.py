from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator
from app.config import settings

Framework = Literal["qiskit", "pennylane", "cirq"]
Algorithm = Literal["bell", "deutsch_jozsa", "bernstein_vazirani", "grover", "qft", "phase_estimation", "shor"]


class CircuitRequest(BaseModel):
    framework: Framework
    code: str = Field(min_length=1)
    shots: int = Field(default=1024, ge=1)

    @field_validator("shots")
    @classmethod
    def enforce_shot_limit(cls, value: int) -> int:
        if value > settings.max_shots:
            raise ValueError(f"Shots cannot exceed the configured limit of {settings.max_shots}.")
        return value

    @field_validator("code")
    @classmethod
    def reject_dangerous_source(cls, value: str) -> str:
        if len(value) > settings.max_code_length:
            raise ValueError(f"Code cannot exceed the configured limit of {settings.max_code_length} characters.")
        blocked = ("__import__", "open(", "eval(", "exec(", "os.", "subprocess", "socket", "requests", "urllib", "pathlib", "globals(", "locals(")
        if any(token in value.lower() for token in blocked):
            raise ValueError("The submitted program contains an operation not allowed in the quantum sandbox.")
        return value


class CircuitMissionSubmission(BaseModel):
    """Structured circuit data accepted only for known server-validated missions."""
    qubits: int = Field(ge=1, le=5)
    operations: list[dict[str, Any]] = Field(min_length=1, max_length=40)


class AlgorithmRequest(BaseModel):
    algorithm: Algorithm
    framework: Framework = "qiskit"
    parameters: dict[str, Any] = Field(default_factory=dict)
    shots: int = Field(default=1024, ge=1)

    @field_validator("shots")
    @classmethod
    def enforce_shot_limit(cls, value: int) -> int:
        if value > settings.max_shots:
            raise ValueError(f"Shots cannot exceed the configured limit of {settings.max_shots}.")
        return value


class IBMRunRequest(BaseModel):
    backend: str | None = Field(default=None, max_length=128)
    shots: int = Field(default=1024, ge=100)
    code: str | None = None

    @field_validator("shots")
    @classmethod
    def enforce_shot_limit(cls, value: int) -> int:
        if value > settings.max_shots:
            raise ValueError(f"Shots cannot exceed the configured limit of {settings.max_shots}.")
        return value

    @field_validator("code")
    @classmethod
    def reject_dangerous_source(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) > settings.max_code_length:
            raise ValueError(f"Code cannot exceed the configured limit of {settings.max_code_length} characters.")
        blocked = ("__import__", "open(", "eval(", "exec(", "os.", "subprocess", "socket", "requests", "urllib", "pathlib", "globals(", "locals(")
        if any(token in value.lower() for token in blocked):
            raise ValueError("The submitted program contains an operation not allowed in the quantum sandbox.")
        return value


class ContestSubmissionRequest(BaseModel):
    submission_type: Literal["code", "ops"]
    framework: Framework | None = None
    code: str | None = None
    ops: list[dict[str, Any]] | None = Field(default=None, max_length=200)

    @field_validator("code")
    @classmethod
    def reject_contest_dangerous_source(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) > settings.max_code_length:
            raise ValueError(f"Code cannot exceed the configured limit of {settings.max_code_length} characters.")
        blocked = ("__import__", "open(", "eval(", "exec(", "os.", "subprocess", "socket", "requests", "urllib", "pathlib", "globals(", "locals(")
        if any(token in value.lower() for token in blocked):
            raise ValueError("The submitted program contains an operation not allowed in the quantum sandbox.")
        return value


class AdminContentRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    status: Literal["draft", "published", "archived"] = "draft"
    sort_order: int = Field(default=0, ge=0, le=100000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AdminRoleRequest(BaseModel):
    role: Literal["student", "instructor", "admin"]


class AdminContestProblemRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    statement: str = Field(min_length=1, max_length=5000)
    contest_type: Literal["coding", "circuit_building"]
    framework: Framework | None = None
    qubit_budget: int = Field(ge=1, le=20)
    gate_budget: int | None = Field(default=None, ge=1, le=500)
    par_gates: int = Field(ge=1, le=500)
    par_depth: int = Field(ge=1, le=500)
    pass_threshold: float = Field(default=0.95, ge=0, le=1)
    order_index: int = Field(default=0, ge=0, le=9)
    reference_ops: list[dict[str, Any]] = Field(min_length=1, max_length=200)

    @field_validator("reference_ops")
    @classmethod
    def validate_reference_ops(cls, value: list[dict[str, Any]], info):
        qubit_budget = info.data.get("qubit_budget")
        allowed_gates = {"H", "X", "Y", "Z", "S", "T", "Rx", "Ry", "Rz", "CNOT", "CZ", "SWAP"}
        for operation in value:
            gate = operation.get("gate")
            target = operation.get("target")
            if gate not in allowed_gates or not isinstance(target, int) or not qubit_budget or not 0 <= target < qubit_budget:
                raise ValueError("Reference circuit contains an unsupported gate or target qubit.")
            if gate in {"CNOT", "CZ", "SWAP"}:
                control = operation.get("control")
                if not isinstance(control, int) or not 0 <= control < qubit_budget or control == target:
                    raise ValueError("Controlled gates need a different in-range control qubit.")
            if gate in {"Rx", "Ry", "Rz"} and not isinstance(operation.get("angle", 1.5707963267948966), (int, float)):
                raise ValueError("Rotation gates need a numeric angle.")
        return value


class AdminContestRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    start_time: datetime
    end_time: datetime
    is_rated: bool = True
    problems: list[AdminContestProblemRequest] = Field(min_length=1, max_length=10)

    @field_validator("end_time")
    @classmethod
    def validate_timeline(cls, value: datetime, info):
        start_time = info.data.get("start_time")
        if not start_time:
            return value
        if value <= start_time:
            raise ValueError("Contest end_time must be later than start_time.")
        return value


class AdminContestUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    start_time: datetime | None = None
    end_time: datetime | None = None
    is_rated: bool | None = None

    @field_validator("end_time")
    @classmethod
    def validate_timeline(cls, value: datetime | None, info):
        start_time = info.data.get("start_time")
        if start_time is not None and value is not None:
            if value <= start_time:
                raise ValueError("Contest end_time must be later than start_time.")
        return value


class AdminAnnouncementRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=5000)
    status: Literal["draft", "published", "archived"] = "draft"


class AdminSettingRequest(BaseModel):
    contest_submission_limit: int = Field(default=10, ge=1, le=50)
    allow_contest_resubmissions: bool = True
    maintenance_message: str = Field(default="", max_length=500)
