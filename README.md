# Code Red: Save the City

A cooperative real-time multiplayer crisis-management browser game. **Current status: playable five-round multiplayer mission with a synchronized lobby and server-authoritative crisis resolution.**

## Stack
- Python FastAPI + python-socketio backend
- React + TypeScript + Vite frontend
- In-memory server-authoritative lobby and mission state

## Run locally

Terminal 1:
```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Terminal 2:
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173 in two browser tabs. Create a room in one and join using the code in the other. Verify both see the same player list and readiness changes.

## Play a mission

Create a room, join from a second browser tab, and ready every player. Only the host sees **Start Mission**, enabled for 2–6 connected, ready players. Roles are assigned in join order: engineer, medic, security, dispatcher (repeated for players five and six).

Each mission uses the first five crises from the eight-scenario engine in a fixed order. Every round allows 45 seconds for one locked action per player:
- **Respond:** 2 points, plus 1 for matching the crisis specialty.
- **Support:** 1 point, plus 1 if the chosen teammate responds.
- **Conserve:** restore 5 of the selected resource, capped at 100.

The server resolves when everyone submits or the deadline expires. Missing actions contribute zero. A successful response meets the points target and pays the crisis resource cost; failure reduces stability. Results remain visible for five seconds before the next round. After five rounds, saving the city requires at least three resolved crises and positive stability.

Disconnects do not pause a mission; the timer continues for missing players. Lobby disconnects clear readiness and block starting. Session recovery, host migration, replay, and room expiry remain future work; refresh and create a new room for a new mission.

## Socket protocol

The server derives room and identity from the socket, never from client-supplied player IDs. Existing lobby events remain unchanged. New events return `{ok, error?}` acknowledgements:
- `start_game {}`: host only, lobby only; validates the entire squad.
- `submit_action {round, kind, target?, resource?}`: current integer round required; validates support target or conserve resource and rejects duplicate/late actions.

`room_state` broadcasts include `mission` (null in the lobby), with phase (`action`, `resolution`, `complete`), round, public crisis, shared Unix-seconds deadline, server time, resources, submitted player IDs, result history, and final outcome. Action choices remain private until scoring. Clients display the shared deadline using elapsed monotonic time; only the server accepts actions and advances rounds.

## Verification

```bash
pip install -r server/requirements-dev.txt
PYTHONPATH=server python -m pytest -q server/tests
cd client
npm ci
npm run build
```

Tests cover scoring, start authorization/readiness/player limits, malformed and stale actions, duplicate submissions, concurrent resolution, timeout/disconnect progression, and a real ASGI/Socket.IO two-client five-round mission.

## Next milestones
1. Secure session recovery, disconnect cleanup, host migration, room expiry.
2. Browser interaction tests, deployment configuration, and persistence.
3. Scenario selection, role selection, and replay.

## Security note
The current starter is for **local development only**. It does not yet implement production-ready authentication, reconnect tokens, room expiration, abuse controls, or CORS configuration. Do not deploy it publicly unchanged.
