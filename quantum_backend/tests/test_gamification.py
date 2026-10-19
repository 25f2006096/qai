import pytest

from app.routers.gamification import _normalise_operations, _simulation_matches_mission, _validate_mission
from app.services.gamification_service import level_for_xp, mask_display_name


def superposition_operations():
    return [{"gate": "H", "target": 0, "col": 0}]


def bell_operations():
    return [
        {"gate": "H", "target": 0, "col": 0},
        {"gate": "CNOT", "control": 0, "target": 1, "col": 1},
    ]


def test_level_thresholds_are_deterministic():
    assert level_for_xp(0) == {
        "number": 1,
        "name": "Quantum Novice",
        "threshold": 0,
        "next_threshold": 100,
        "progress_percent": 0,
    }
    assert level_for_xp(100)["number"] == 2
    assert level_for_xp(900)["name"] == "Entanglement Engineer"
    assert level_for_xp(5000)["progress_percent"] == 100


def test_valid_superposition_requires_exact_learning_sequence():
    ops = _normalise_operations(superposition_operations(), 1)
    assert _validate_mission("build-superposition", ops, 1)
    assert _simulation_matches_mission("build-superposition", ops, 1)
    assert not _validate_mission("build-superposition", [{"gate": "X", "target": 0, "col": 0}], 1)


def test_valid_bell_state_is_simulated_server_side():
    ops = _normalise_operations(bell_operations(), 2)
    assert _validate_mission("build-bell-state", ops, 2)
    assert _simulation_matches_mission("build-bell-state", ops, 2)


def test_mission_validation_rejects_invalid_circuit_data():
    with pytest.raises(ValueError, match="unsupported gate"):
        _normalise_operations([{"gate": "UNSAFE", "target": 0}], 1)
    with pytest.raises(ValueError, match="control"):
        _normalise_operations([{"gate": "CNOT", "target": 0, "control": 0}], 1)
    with pytest.raises(ValueError, match="not supported"):
        _validate_mission("not-a-real-mission", [], 1)


def test_privacy_safe_leaderboard_display_name():
    assert mask_display_name("Alice Johnson") == "Alice J."
    assert mask_display_name("Bob") == "Bob"
    assert mask_display_name(None) == "Quantum Explorer"
    assert mask_display_name("   ") == "Quantum Explorer"
