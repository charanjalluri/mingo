# 🚀 Mingo - Private Squad Messaging Application

Mingo is a private, real-time messaging application designed exclusively for authorized team members.

## 🔑 Authorized Members & Access Keys

Mingo is pre-seeded with 5 authorized members. Users can log in using their username and access key or change their display name and key anytime from Profile Settings:

| Member | Username | Access Key | Role |
| :--- | :--- | :--- | :--- |
| **Charan** | `charan` | `mg-charan-8921` | Lead Developer & Architect |
| **Ravi** | `ravi` | `mg-ravi-4712` | Senior Infrastructure Engineer |
| **Bheem** | `bheem` | `mg-bheem-3158` | Product Lead & Strategy |
| **Kausik** | `kausik` | `mg-kausik-9043` | Principal UI/UX Designer |
| **Jack** | `jack` | `mg-jack-6287` | Security & Cryptography Specialist |

---

## ✨ Features

- **Real-Time WebSockets**: Instant message delivery, live presence indicators, typing status, and sent/delivered/read receipts.
- **Rich Messaging**: Voice note recording (MediaRecorder API) with waveform player, image sharing with lightbox viewer, message search, emoji reactions, quote replies, message editing, and deletion.
- **Auto-Scroll & New Messages Pill**: Smart scroll mechanics that don't disrupt reading past message history.
- **Display Name & Profile Management**: Options to change display name, bio, avatar, and password/key anytime.
- **Light & Dark Mode**: Modern design system using CSS tokens with high contrast and smooth transitions.
- **Responsive Layout**: Mobile drawer navigation down to 360px up to 4K monitors.

---

## 🛠️ Local Development Setup

### 1. Backend Setup (FastAPI + WebSockets)
```bash
cd backend
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup (React + TypeScript + Vite)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Automated Tests

```bash
# Run backend pytest suite
cd backend
pytest

# Run frontend tests
cd frontend
npm test
```

---

## 🐳 Running with Docker

```bash
docker-compose up --build
```
