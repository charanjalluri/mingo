# Mingo Project Handover & Deployment Guide

## 1. Executive Summary

Mingo's local application core (FastAPI backend, React frontend, SQLite/Neon database, authentication, and WebSocket real-time broadcast engine) is fully functional and passing all automated test suites (including multi-user WebSocket broadcast integration tests).

However, the public production deployment URL (`https://mingo-app.onrender.com`) is currently bound to an unrelated plain-text service returning `"Mingo push notifier is running."`. The Mingo application repository configuration (`render.yaml` + root `Dockerfile`) has been fixed and committed on `main` at commit `55429dc`.

---

## 2. Current Production Deployment Status

- **Target Public URL**: `https://mingo-app.onrender.com`
- **Current Status**: **Deployment Mismatch / Pending Blueprint Application** ❌
- **Live Response**:
  ```http
  HTTP/1.1 200 OK
  Content-Type: text/plain; charset=utf-8
  x-render-origin-server: Render

  Mingo push notifier is running.
  ```
- **Diagnosis**: The existing Render service at `https://mingo-app.onrender.com` is either:
  1. Points to an old/unrelated repository or service ("Mingo push notifier").
  2. Has not applied the `render.yaml` Blueprint spec from `https://github.com/charanjalluri/mingo`.

---

## 3. Deployment Configuration Audit (Commit `55429dc`)

The repository at `https://github.com/charanjalluri/mingo` (branch `main`) contains the complete deployment specification:

1. **[render.yaml](file:///d:/fourchat/render.yaml)**:
   ```yaml
   services:
     - type: web
       name: mingo-app
       runtime: docker
       repo: https://github.com/charanjalluri/mingo
       plan: free
       dockerfilePath: Dockerfile
       dockerContext: .
       envVars:
         - key: SECRET_KEY
           generateValue: true
         - key: DATABASE_URL
           value: sqlite+aiosqlite:///./mingo.db
   ```
2. **[Dockerfile](file:///d:/fourchat/Dockerfile)**:
   - Multi-stage build (`node:20-alpine` frontend builder + `python:3.11-slim` production runner).
   - Serves FastAPI backend and static React frontend assets from `/app/frontend/dist`.
   - Exposes port `8000` and starts via `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.
3. **Clean Build Context**: Redundant `backend/Dockerfile` has been removed to prevent path ambiguity during Render builds.

---

## 4. Required Manual Render Setup Steps

Because Render requires authenticated access to the user's dashboard, follow these exact steps to deploy Mingo to `https://mingo-app.onrender.com`:

### Option A: Apply Blueprint (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect repository `https://github.com/charanjalluri/mingo` (Branch: `main`).
4. Render will detect `render.yaml` and configure the `mingo-app` Web Service with Docker runtime and context `.`.
5. Click **Apply**.

### Option B: Update Existing Web Service
1. In Render Dashboard, open the existing web service `mingo-app`.
2. Go to **Settings**:
   - **Repository**: `https://github.com/charanjalluri/mingo`
   - **Branch**: `main`
   - **Environment / Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Build Context Directory**: `.` (Root directory)
3. Under **Manual Deploy**, click **Clear build cache & deploy** or **Deploy latest commit**.

---

## 5. Post-Deployment Verification Protocol

Once Render completes the build and deployment, execute the following verification steps:

### 1. HTTP Endpoint Verification
Run the following checks to confirm the actual Mingo app is live:
```bash
curl -i https://mingo-app.onrender.com
# Must return HTTP 200 with HTML containing <title>Mingo - Private Squad Messaging</title>

curl -i https://mingo-app.onrender.com/api/auth/users
# Must return HTTP 200 with JSON list of 5 squad users
```

### 2. Two-User Production WebSocket Test
Open two separate browser sessions (or private browsing windows):
1. **Window 1**: Log in as `charan` (Access Key: `mg-charan-8921`).
2. **Window 2**: Log in as `ravi` (Access Key: `mg-ravi-3819`).
3. Verify Developer Tools Network tab: Both clients must show `/ws` connection with `101 Switching Protocols`.
4. **Charan** sends `"Hi"` -> **Ravi** receives `"Hi"` instantly in real time without refreshing.
5. **Ravi** sends `"Hii"` -> **Charan** receives `"Hii"` instantly in real time without refreshing.
6. Refresh both browser tabs -> Conversation history remains intact.
7. Close and reopen client -> Real-time messaging resumes immediately upon reconnect.

---

## 6. Separate Follow-up Issue: Docker Compose Configuration

- **File**: [docker-compose.yml](file:///d:/fourchat/docker-compose.yml) & [frontend/vite.config.ts](file:///d:/fourchat/frontend/vite.config.ts)
- **Issue**: `vite.config.ts` configures Vite proxy targets to `http://127.0.0.1:8000` and `ws://127.0.0.1:8000`. When running local multi-container Docker Compose (`docker-compose up`), `127.0.0.1` inside the `frontend` container resolves to the `frontend` container itself rather than the `backend` container.
- **Recommended Action**: For Docker Compose environments, update proxy targets or environment variables to target `backend:8000`. (Logged for future Docker Compose enhancement; production deployment uses single-container Dockerfile where proxy is unneeded).
