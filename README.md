# Code Red: Save the City

A cooperative real-time multiplayer crisis-management browser game. **Current status: Milestone 1 starter — synchronized lobby only, not yet a complete game.**

## Stack
- Python FastAPI + python-socketio backend
- React + TypeScript + Vite frontend
- In-memory server-authoritative lobby state

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

## Next milestones
1. Secure session recovery, disconnect cleanup, room expiry, validation and origin restrictions.
2. Server-authoritative round state machine and five-round crisis engine.
3. Roles, actions, resources, scoring and win/loss rules.
4. Tests, accessibility, multiplayer browser tests, deployment.

## Security note
The current starter is for **local development only**. It does not yet implement production-ready authentication, reconnect tokens, room expiration, abuse controls, or CORS configuration. Do not deploy it publicly unchanged.
