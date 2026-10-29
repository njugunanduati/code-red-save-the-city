# Publish the playable beta

This version uses Vercel for the frontend and one Render Python web service for multiplayer. All players must connect to that same backend. Do not deploy the Python server as independent Vercel functions or increase its worker/instance count: rooms and round timers currently live in process memory.

## 1. Python multiplayer service (Render)

Connect this GitHub repository and deploy `feature/game-engine` for the review build. The included `render.yaml` describes a free beta service. If creating it manually:

- Runtime: Python 3; root directory: `server`.
- Build: `pip install -r requirements.txt`.
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`.
- Health check: `/health`.
- Instances: one. No horizontal autoscaling.
- `ALLOWED_ORIGINS`: your exact Vercel frontend origin, such as `https://your-game.vercel.app`. Multiple approved origins can be comma-separated; no wildcard or path.

Save the server's real HTTPS URL. Check `/health` returns `status: ok`. A free service may take about a minute to wake after inactivity. Restarts and deployments clear rooms, missions and chat. This is a limited beta, not a persistent public service.

## 2. Frontend (Vercel)

Import `njugunanduati/code-red-save-the-city`:

- Root Directory: `client`.
- Framework: Vite.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Environment variable `VITE_SOCKET_URL`: the real HTTPS Render server URL, with no `/socket.io` suffix.

Set the variable for the deployment environments being used (Preview and/or Production), then deploy the feature branch for review. Vercel's build intentionally fails if its backend URL is missing or points to localhost. Changing the variable requires a new build/deployment. The backend address is public configuration, not a secret.

After the frontend URL is assigned, update Render's `ALLOWED_ORIGINS` to that exact origin, redeploy the server, and retry the frontend. Approve each preview URL explicitly, or use a stable assigned domain; do not allow all `vercel.app` origins.

## 3. Test the submission requirements

1. Open the hosted frontend in a laptop on Wi-Fi and a phone on mobile data. If Vercel deployment protection is enabled, ensure intended testers can access the link.
2. Each player opens **How to play** and follows it without assistance.
3. Create a room, copy/share its code, join from the other device, and ready both players.
4. Only the host starts. Verify the same crisis and countdown on both devices.
5. Exchange live radio messages; submit actions and verify the same results through all five rounds.
6. Verify host-only restart/advance controls and chat restrictions before/after missions.
7. Test a fresh room with another tester who is not on the host's network.

Record the tested frontend URL and backend URL. A frontend that loads without a working multiplayer server does not satisfy the requirements. Two local browser tabs also do not prove remote-device connectivity.

## 4. Release

After hosted checks pass and the user explicitly approves merging, merge PR #1. Change the Render deployment branch from `feature/game-engine` to `main`; use `main` as Vercel's production branch. Redeploy both, verify the public URL, and share it with the game rules.

GitHub Actions runs server tests and the frontend build on PRs and pushes. It does not deploy cloud resources or prove two-device access.
