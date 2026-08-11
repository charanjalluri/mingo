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
