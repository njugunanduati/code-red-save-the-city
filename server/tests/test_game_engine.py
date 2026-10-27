from app.game_engine import CRISES, resolve

PLAYERS = {"a": {"role": "engineer"}, "b": {"role": "medic"}}
RESOURCES = {"stability": 80, "energy": 70, "medical": 60, "security": 65}

def test_two_responders_resolve_blackout():
    result = resolve(CRISES[0], PLAYERS,
                     {"a": {"kind": "respond"}, "b": {"kind": "respond"}}, RESOURCES)
    assert result["success"] is True
    assert result["points"] == 5
    assert result["resources"]["energy"] == 55
    assert RESOURCES["energy"] == 70

def test_unresolved_crisis_reduces_stability():
    result = resolve(CRISES[0], PLAYERS, {}, RESOURCES)
    assert result["success"] is False
    assert result["resources"]["stability"] == 68

def test_support_boosts_active_responder():
    result = resolve(CRISES[0], PLAYERS,
                     {"a": {"kind": "respond"}, "b": {"kind": "support", "target": "a"}}, RESOURCES)
    assert result["points"] == 5
    assert result["success"] is True

def test_conserve_restores_resource_without_mutation():
    result = resolve(CRISES[0], PLAYERS,
                     {"a": {"kind": "conserve", "resource": "medical"}}, RESOURCES)
    assert result["resources"]["medical"] == 65
    assert RESOURCES["medical"] == 60

def test_invalid_action_is_rejected():
    import pytest
    with pytest.raises(ValueError):
        resolve(CRISES[0], PLAYERS, {"a": {"kind": "teleport"}}, RESOURCES)
