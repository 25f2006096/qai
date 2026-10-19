from app.routers.gamification import _matches_mission
from app.schemas import CircuitMissionSubmission
from app.services.gamification_service import level_for_xp


def test_circuit_mission_validation_requires_the_learning_objective():
    superposition = CircuitMissionSubmission(qubits=1, operations=[{"gate": "H", "target": 0, "col": 0}])
    incomplete_bell = CircuitMissionSubmission(qubits=2, operations=[{"gate": "H", "target": 0, "col": 0}])
    noisy_superposition = CircuitMissionSubmission(qubits=1, operations=[{"gate": "H", "target": 0, "col": 0}, {"gate": "X", "target": 0, "col": 1}])
    reversed_bell = CircuitMissionSubmission(qubits=2, operations=[
        {"gate": "CNOT", "control": 0, "target": 1, "col": 0},
        {"gate": "H", "target": 0, "col": 1},
    ])
    bell = CircuitMissionSubmission(qubits=2, operations=[
        {"gate": "H", "target": 0, "col": 0},
        {"gate": "CNOT", "control": 0, "target": 1, "col": 1},
    ])
    assert _matches_mission("build-superposition", superposition)
    assert not _matches_mission("build-superposition", noisy_superposition)
    assert not _matches_mission("build-bell-state", incomplete_bell)
    assert not _matches_mission("build-bell-state", reversed_bell)
    assert _matches_mission("build-bell-state", bell)


def test_level_progress_uses_the_documented_formula():
    assert level_for_xp(100)["number"] == 2
    assert level_for_xp(100)["name"] == "Qubit Explorer"
    assert level_for_xp(100)["progress_percent"] == 0
