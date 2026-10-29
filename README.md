# Code Red: Save the City

A cooperative real-time multiplayer crisis-management browser game. **Current status: playable five-round multiplayer mission with a synchronized lobby and server-authoritative crisis resolution.**

## Stack
- Python FastAPI + python-socketio backend
- React + TypeScript + Vite frontend
- In-memory server-authoritative lobby and mission state

## Publish and share

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel + Render beta setup and separate-device acceptance checks. Players can open **How to play** from the game header.

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

Each mission uses five crises from the eight-scenario engine in a deterministic rotating order. Mission 1 begins with Hospital Blackout; Mission 2 begins with Hospital Ransomware. The eight existing scenarios cycle across later missions. Every round allows 45 seconds for one locked action per player:
- **Respond:** 2 points, plus 1 for matching the crisis specialty.
- **Support:** 1 point, plus 1 if the chosen teammate responds.
- **Conserve:** restore 5 of the selected resource, capped at 100.

The server resolves when everyone submits or the deadline expires. Missing actions contribute zero. A successful response meets the points target and pays the crisis resource cost; failure reduces stability. Results remain visible for five seconds before the next round. After five rounds, saving the city requires at least three resolved crises and positive stability.

Disconnects do not pause a mission; the timer continues for missing players. Lobby disconnects clear readiness and block starting. After completion, the host can choose **Start over** to return to Mission 1, or **Next mission** after a win to advance the crisis sequence. Both return the squad to the same lobby, clear readiness and roles, remove offline players, and restore starting resources when the host launches again. Everyone must ready up again. Session recovery, host migration, and room expiry remain future work.

## Socket protocol

The server derives room and identity from the socket, never from client-supplied player IDs. Existing lobby events remain unchanged. New events return `{ok, error?}` acknowledgements:
- `start_game {}`: host only, lobby only; validates the entire squad.
- `submit_action {missionId, round, kind, target?, resource?}`: current mission token and integer round required; validates support target or conserve resource and rejects duplicate/late actions.

`reset_game {mode: "restart" | "next"}` is host-only and completion-only; advancing requires a win.

The daytime city follows a boulevard perspective with a blue sky, distant skyline, colorful raised buildings, tree-lined streets, and traffic, inspired by the supplied city reference. Actors and road routes share its projection; the camera is fixed.

## Live squad communication

Players type freely into **Live Squad Radio** only while a mission is running, including the pauses between rounds. The composer is disabled in the lobby and after completion; previous messages remain readable. The host is marked **★ Leader**. Use it to ask “Team, do you copy?”, reply “Copy”, request direction, or coordinate a plan before choosing an action. Quick-reply buttons fill the draft for editing; sending chat does not submit a game action. Automatic character dialogue has been removed.

`send_message {text}` accepts 1–240 characters from a connected room member during an active mission. The server assigns sender identity and leader status, limits sends to one per 0.6 seconds, keeps the latest 50 messages in memory, and broadcasts only to that room. Messages remain across mission resets, with sender names captured at send time. React renders text without HTML interpretation. The latest message appears briefly over its sender's actor; the complete text remains in the radio log. This is squad-wide communication, not private messaging. Reduced-motion preferences disable movement effects.

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
2. Hosted separate-device acceptance tests, broader browser coverage, and persistence.
3. Scenario selection, role selection, richer character animation, and building-specific crisis effects.

## Beta hosting limits

Deployment settings cover a controlled multiplayer playtest, with exact frontend origins configured using `ALLOWED_ORIGINS`. This version still lacks production-ready authentication, reconnect tokens, room expiry, and comprehensive abuse controls. Run one Python instance and one worker. Server restarts clear game state; use the deployment guide before sharing with testers.
