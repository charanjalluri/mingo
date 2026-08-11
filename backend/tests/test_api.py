from __future__ import annotations
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.test_security import reset_database

@pytest.mark.asyncio
async def test_auth_and_conversations():
    # Ensure DB is cleanly seeded
    await reset_database()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Root check
        res = await ac.get("/")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # 2. Get authorized users list
        users_res = await ac.get("/api/auth/users")
        assert users_res.status_code == 200
        users = users_res.json()
        assert len(users) == 5

        # 3. Login with Charan
        login_res = await ac.post("/api/auth/login", json={"username": "charan", "password": "mg-charan-8921"})
        assert login_res.status_code == 200
        token_data = login_res.json()
        assert "access_token" in token_data
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 4. Check Me
        me_res = await ac.get("/api/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["username"] == "charan"

        # 5. List Conversations
        conv_res = await ac.get("/api/conversations", headers=headers)
        assert conv_res.status_code == 200
        convs = conv_res.json()
        assert len(convs) >= 1  # Includes 'Mingo Squad'

        squad = next(c for c in convs if c["type"] == "group")
        assert squad["name"] == "Mingo Squad"

        # 6. Post a message to Mingo Squad
        msg_res = await ac.post("/api/messages", json={
            "conversation_id": squad["id"],
            "content": "Automated pytest message check! 🧪",
            "message_type": "text"
        }, headers=headers)
        assert msg_res.status_code == 200
        msg = msg_res.json()
        assert msg["content"] == "Automated pytest message check! 🧪"

        # 7. Add reaction
        react_res = await ac.post(f"/api/messages/{msg['id']}/reactions", json={"emoji": "❤️"}, headers=headers)
        assert react_res.status_code == 200

        # 8. Edit message
        edit_res = await ac.put(f"/api/messages/{msg['id']}", json={"content": "Edited automated message!"}, headers=headers)
        assert edit_res.status_code == 200
        assert edit_res.json()["is_edited"] is True

        # 9. Invalid login test
        bad_login = await ac.post("/api/auth/login", json={"username": "charan", "password": "wrongpassword"})
        assert bad_login.status_code == 401


def test_websocket_realtime_broadcast():
    from fastapi.testclient import TestClient
    import asyncio

    asyncio.run(reset_database())

    with TestClient(app) as client:
        # Login Charan
        res_a = client.post("/api/auth/login", json={"username": "charan", "password": "mg-charan-8921"})
        assert res_a.status_code == 200
        token_a = res_a.json()["access_token"]

        # Login Ravi
        res_b = client.post("/api/auth/login", json={"username": "ravi", "password": "mg-ravi-4712"})
        assert res_b.status_code == 200
        token_b = res_b.json()["access_token"]

        # Get Mingo Squad conversation ID
        convs = client.get("/api/conversations", headers={"Authorization": f"Bearer {token_a}"}).json()
        squad_id = next(c["id"] for c in convs if c["type"] == "group")

        def receive_message_content(ws, expected_content):
            for _ in range(10):
                evt = ws.receive_json()
                if evt.get("type") == "new_message" and evt.get("payload", {}).get("content") == expected_content:
                    return evt
            raise AssertionError(f"Expected message content '{expected_content}' not received")

        # Connect Charan & Ravi WebSockets from production HTTPS origin
        with client.websocket_connect(f"/ws?token={token_a}", headers={"origin": "https://mingo-app.onrender.com"}) as ws_a, \
             client.websocket_connect(f"/ws?token={token_b}", headers={"origin": "https://mingo-app.onrender.com"}) as ws_b:
            
            # Send message from Charan (User A)
            send_res_a = client.post("/api/messages", json={
                "conversation_id": squad_id,
                "content": "Hi Ravi! Live WebSocket test.",
                "message_type": "text"
            }, headers={"Authorization": f"Bearer {token_a}"})
            assert send_res_a.status_code == 200

            # Receive on Ravi's (User B) WebSocket
            event_b = receive_message_content(ws_b, "Hi Ravi! Live WebSocket test.")
            assert event_b["payload"]["content"] == "Hi Ravi! Live WebSocket test."

            # Send message back from Ravi (User B)
            send_res_b = client.post("/api/messages", json={
                "conversation_id": squad_id,
                "content": "Hii Charan! Got your message live.",
                "message_type": "text"
            }, headers={"Authorization": f"Bearer {token_b}"})
            assert send_res_b.status_code == 200

            # Receive on Charan's (User A) WebSocket
            event_a = receive_message_content(ws_a, "Hii Charan! Got your message live.")
            assert event_a["payload"]["content"] == "Hii Charan! Got your message live."

