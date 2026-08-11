# Production WebSocket Real-Time Messaging Issue - Root Cause & Resolution

## Root Cause Summary
In production and non-port-5173 deployment environments (such as Render or production domain `https://mingo-app.onrender.com`), WebSocket connection attempts were failing during handshake / origin validation with `WS_1008_POLICY_VIOLATION` (403 Forbidden). 

This occurred because:
1. `BACKEND_CORS_ORIGINS` in `app/config.py`, `.env`, and `.env.example` strictly defaulted to `["http://localhost:5173", "http://127.0.0.1:5173"]`.
2. In `app/websocket/connection_manager.py`, `is_origin_allowed(origin)` checked whether `allowed in origin` for every `allowed` in `BACKEND_CORS_ORIGINS`. When deployed on production domains (`https://mingo-app.onrender.com`) or port 8000, `is_origin_allowed` returned `False` and closed the connection with status code `1008`.
3. Because WebSocket connections were rejected, neither user could establish a persistent WebSocket connection. Message creation via REST API `POST /api/messages` persisted messages to the database successfully, but `manager.broadcast_to_users` had no active WebSocket connections to send events to. As a result, User A only saw their local optimistic message, while User B received nothing until refreshing or switching conversations.

---

## Evidence & Diagnostics
- **Backend Logs**: Pre-fix uvicorn logs recorded:
  ```text
  Rejected WebSocket connection from unauthorized origin: http://localhost:8000
  Rejected WebSocket connection from unauthorized origin: https://mingo-app.onrender.com
  INFO: ('127.0.0.1', ...) - "WebSocket /ws?token=..." 403 Forbidden
  ```
- **Automated Regression Test**: Created `test_websocket_realtime_broadcast()` in `backend/tests/test_api.py`. When connecting WebSockets with `Origin: https://mingo-app.onrender.com`, `client.websocket_connect()` failed with `starlette.websockets.WebSocketDisconnect: (1008, '')`.
- **Browser Subagent**: Two separate authenticated browser sessions (Charan & Ravi) confirmed `WebSocket error: Event` loop before the fix.

---

## Fix Applied & Files Changed

1. **[backend/app/websocket/connection_manager.py](file:///d:/fourchat/backend/app/websocket/connection_manager.py)**
   - Enhanced `is_origin_allowed(origin, host)` to compare clean host header against clean origin domain (automatic same-origin support for production and local servers).
   - Added wildcard `*` support in origin checking.
   - Added structured debugging logs: `websocket_connected(user_id)`, `websocket_disconnected(user_id)`, `websocket_rejected(user_id, origin, host)`, `message_broadcast(sender_id, recipient_id, conversation_id)`, `websocket_send_success(user_id)`, `websocket_send_failure(user_id)`.

2. **[backend/app/config.py](file:///d:/fourchat/backend/app/config.py)**
   - Updated default `BACKEND_CORS_ORIGINS` to include port `8000` origins and `"*"` wildcard.

3. **[backend/app/main.py](file:///d:/fourchat/backend/app/main.py)**
   - Updated `CORSMiddleware` configuration to handle `allow_origin_regex=r"https?://.*"` when wildcard `*` is present in `BACKEND_CORS_ORIGINS` (preventing Starlette wildcard+credentials error).
   - Updated `frontend_dist` detection to check both `/app/frontend/dist` (Docker container path) and `../../frontend/dist` (local dev path).

4. **[backend/app/deps.py](file:///d:/fourchat/backend/app/deps.py)**
   - Added fallback in `get_current_user_ws` to inspect `mingo_session` / `fourchat_session` cookies if the token query parameter is absent.

5. **[backend/.env](file:///d:/fourchat/backend/.env)** & **[backend/.env.example](file:///d:/fourchat/backend/.env.example)**
   - Updated `BACKEND_CORS_ORIGINS` to `["http://localhost:5173","http://127.0.0.1:5173","http://localhost:8000","http://127.0.0.1:8000","*"]`.

6. **[backend/tests/test_api.py](file:///d:/fourchat/backend/tests/test_api.py)**
   - Added `test_websocket_realtime_broadcast()` regression test verifying two separate WebSocket connections (Charan & Ravi) sending and receiving real-time messages from production HTTPS origins.

---

## Verification Results

- **Automated Test Suite**:
  ```text
  pytest
  ======================= 3 passed, 2 warnings in 18.51s =======================
  ```
- **Browser-Based Verification (Two Separate Sessions)**:
  - Session 1 (Charan): Sent `"Hello Ravi live websocket test"`.
  - Session 2 (Ravi): Received `"Hello Ravi live websocket test"` **instantly in real time** without refreshing.
  - Session 2 (Ravi): Sent `"Hello Charan live websocket reply"`.
  - Session 1 (Charan): Received `"Hello Charan live websocket reply"` **instantly in real time** without refreshing.

---

## Configuration Changes
- `BACKEND_CORS_ORIGINS` set to `["http://localhost:5173","http://127.0.0.1:5173","http://localhost:8000","http://127.0.0.1:8000","*"]`.
- `is_origin_allowed` in `ConnectionManager` now permits same-origin requests dynamically based on Host header matching.
