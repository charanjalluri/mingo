from __future__ import annotations
import os
# pyrefly: ignore [missing-import]
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import engine, Base
from app.seed import seed_db, async_session_maker

async def reset_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with async_session_maker() as session:
        await seed_db(session)

@pytest.mark.asyncio
async def test_security_audit_suite():
    await reset_database()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Verify 5-member account roster lockdown & registration blocking
        users_res = await ac.get("/api/auth/users")
        assert users_res.status_code == 200
        users = users_res.json()
        assert len(users) == 5, "System must be locked to authorized squad accounts"

        reg_res = await ac.post("/api/auth/register", json={"username": "hacker"})
        assert reg_res.status_code in [404, 405]

        # 2. Verify Login & Security Headers
        login_res = await ac.post("/api/auth/login", json={"username": "charan", "password": "mg-charan-8921"})
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        charan_headers = {"Authorization": f"Bearer {token}"}

        assert login_res.headers.get("X-Content-Type-Options") == "nosniff"
        assert login_res.headers.get("X-Frame-Options") == "DENY"
        assert "Content-Security-Policy" in login_res.headers

        # 3. Verify Login Rate Limiting (Brute Force Protection)
        for _ in range(5):
            await ac.post("/api/auth/login", json={"username": "brute_target", "password": "wrong_access_key"})
        
        rate_limited_res = await ac.post("/api/auth/login", json={"username": "brute_target", "password": "wrong_access_key"})
        assert rate_limited_res.status_code == 429, "Should block brute force attempts with 429 Too Many Requests"

        # 4. Verify IDOR Protection on Conversations
        # Login as Ravi
        ravi_login = await ac.post("/api/auth/login", json={"username": "ravi", "password": "mg-ravi-4712"})
        ravi_token = ravi_login.json()["access_token"]
        ravi_headers = {"Authorization": f"Bearer {ravi_token}"}

        # Find direct conversation between Charan and Jack (which Ravi is NOT part of)
        charan_convs = (await ac.get("/api/conversations", headers=charan_headers)).json()
        jack_direct = next(c for c in charan_convs if c["type"] == "direct" and any(p["username"] == "jack" for p in c["participants"]))
        
        # Ravi attempts IDOR access to Charan-Jack direct chat
        idor_msgs = await ac.get(f"/api/messages?conversation_id={jack_direct['id']}", headers=ravi_headers)
        assert idor_msgs.status_code == 403, "Ravi must be denied access to Charan-Jack direct conversation"

        # 5. Verify Magic Byte Upload Validation
        fake_png_bytes = b"<?php echo 'malicious script'; ?>"
        upload_files = {"file": ("malicious.png", fake_png_bytes, "image/png")}
        fake_upload_res = await ac.post("/api/uploads/image", files=upload_files, headers=charan_headers)
        assert fake_upload_res.status_code == 400, "Should reject spoofed PNG file binary headers"

        # Valid PNG magic bytes test
        valid_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        valid_upload_files = {"file": ("valid.png", valid_png_bytes, "image/png")}
        valid_upload_res = await ac.post("/api/uploads/image", files=valid_upload_files, headers=charan_headers)
        assert valid_upload_res.status_code == 200

        # 6. Verify Path Traversal Protection on Media Serving
        traversal_res = await ac.get("/api/uploads/../app/main.py", headers=charan_headers)
        assert traversal_res.status_code in [400, 404], "Path traversal attempts must be rejected"

        # 7. Verify Logout Session Revocation
        logout_res = await ac.post("/api/auth/logout", headers=charan_headers)
        assert logout_res.status_code == 200

        # Attempt to use revoked token
        revoked_access_res = await ac.get("/api/auth/me", headers=charan_headers)
        assert revoked_access_res.status_code == 401, "Revoked token must be rejected with 401 Unauthorized"
