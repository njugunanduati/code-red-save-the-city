"""Deterministic, network-independent Code Red crisis resolution."""
from dataclasses import dataclass
from typing import Literal

ActionKind = Literal["respond", "support", "conserve"]
Resource = Literal["energy", "medical", "security"]

@dataclass(frozen=True)
class Crisis:
    key: str
    title: str
    description: str
    specialty: str
    target: int
    resource: Resource
    cost: int
    penalty: int

CRISES = (
    Crisis("blackout", "Hospital Blackout", "Restore emergency power to the hospital.", "engineer", 4, "energy", 15, 12),
    Crisis("surge", "Emergency Room Surge", "Coordinate urgent care for incoming patients.", "medic", 4, "medical", 15, 12),
    Crisis("breach", "City Network Breach", "Contain a coordinated cyberattack.", "security", 4, "security", 15, 12),
    Crisis("grid", "Power Grid Failure", "Stabilize the city's electrical grid.", "engineer", 5, "energy", 20, 15),
    Crisis("ambulances", "Ambulance Dispatch Crisis", "Restore emergency routing.", "dispatcher", 5, "medical", 15, 15),
    Crisis("ransomware", "Hospital Ransomware", "Isolate compromised medical systems.", "security", 5, "security", 20, 15),
    Crisis("evacuation", "Citywide Evacuation", "Coordinate emergency evacuation.", "dispatcher", 5, "energy", 20, 18),
    Crisis("storm", "Severe Storm", "Protect essential services from flooding.", "engineer", 5, "energy", 20, 18),
)

def resolve(crisis: Crisis, players: dict, actions: dict, resources: dict) -> dict:
    """Pure function; never modifies caller-owned objects.

    players: player_id -> {"role": str}
    actions: player_id -> {"kind": ..., "resource"?: ..., "target"?: ...}
    """
    updated = dict(resources)
    points = 0
    responders = set()
    for pid, action in actions.items():
        if pid not in players:
            raise ValueError("Unknown player")
        kind = action.get("kind")
        if kind not in ("respond", "support", "conserve"):
            raise ValueError("Invalid action")
        if kind == "respond":
            responders.add(pid)
            points += 2 + int(players[pid].get("role") == crisis.specialty)
    for pid, action in actions.items():
        if action["kind"] == "support":
            points += 1
            if action.get("target") in responders and action["target"] != pid:
                points += 1
        elif action["kind"] == "conserve":
            resource = action.get("resource")
            if resource not in ("energy", "medical", "security"):
                raise ValueError("Invalid resource")
            updated[resource] = min(100, updated[resource] + 5)
    success = points >= crisis.target and updated[crisis.resource] >= crisis.cost
    if success:
        updated[crisis.resource] -= crisis.cost
    else:
        updated["stability"] = max(0, updated["stability"] - crisis.penalty)
    return {"success": success, "points": points, "target": crisis.target,
            "resources": updated, "crisis": crisis.key}
