# Sentinel — Smart Safety & Surveillance Platform

Sentinel is an AI-powered safety and surveillance platform designed to automate security and monitoring across boarding schools, retail malls, and supermarkets.

---

## 1. System Overview & Integration Flow

Sentinel consists of two primary services:
1. **FastAPI Backend (`/app`)**: Manages configurations, multi-tenant databases, real-time WebSocket messaging, file storage, and automated notification escalations.
2. **ML Inference Service (`/ml`)**: Runs deep learning models (YOLO, ArcFace, OSNet, YAMNet) to analyze video/audio data on a frame-by-frame basis.

### The End-to-End Surveillance Pipeline

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Edge Camera ├──────>│ FastAPI Backend ├──────>│   ML Service    │
│ (Frame B64) │       │ (REST Endpoint) │       │ (Inference/GPU) │
└─────────────┘       └────────┬────────┘       └────────┬────────┘
                               │                         │
                               │  Match Vector / Alerts  │  Identify Objects,
                               │<────────────────────────┘  Behaviors, Audio
                               │
                      ┌────────┴────────┐
                      │ Database search │ (pgvector similarity search)
                      └────────┬────────┘
                               │
                     ┌─────────┴─────────┐
                     ▼                   ▼
            ┌─────────────────┐ ┌─────────────────┐
            │   Web Clients   │ │ Africa'sTalking │
            │ (WebSockets WS) │ │  (SMS / Voice)  │
            └─────────────────┘ └─────────────────┘
```

1. **Edge Dispatch**: An edge camera posts a base64 encoded frame (and audio WAV snippet) to the backend API: `POST /api/v1/surveillance/process-frame`.
2. **Inference Request**: The backend forwards the payload to the ML service endpoint: `POST /process-frame`.
3. **ML Inference & Fusion**: The ML service runs face detection, pose-estimation trackers, behavior classifiers, and audio parsers. It fuses these indicators into a unified threat probability assessment and returns it to the backend.
4. **Vector Database Matching**: The backend takes any returned embeddings and queries the database using **pgvector** cosine similarity:
   - Matches face embeddings against enrolled **Persons** (e.g. Students) or **Persons of Interest (POIs)**.
   - Matches body crops against Re-ID coordinates for cross-camera suspicious target tracking.
5. **Alerting & Notification**:
   - **Snapshots**: If a threat is detected or a POI is identified, a high-resolution snapshot is written to local disk evidence logs (`uploads/`).
   - **Incidents**: The system logs detection indicators and inserts a record into the `incidents` database table.
   - **WebSockets**: The incident event is immediately pushed to the Redis event bus and streamed to dashboard clients (`/ws/stream/events`).
   - **Parent Alerts**: For school entries and exits, SMS notifications are immediately dispatched to guardians.
   - **Escalations**: Active threats are escalated to security staff via automated SMS and voice calls using **Africa's Talking SDK**.

---

## 2. Getting Started

### Prerequisites
- Python 3.12+
- Docker & Docker Compose (for PostgreSQL with pgvector, and Redis)
- UV Package Manager

### Step 1: Start Core Infrastructure Services
Launch Postgres and Redis using your docker compose toolchain:
```bash
docker compose up -d
```

### Step 2: Setup Python Virtual Environment
Install virtual environment tools and dependencies for both services:
```bash
# Initialize and sync dependencies
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Create `.env` configurations in both directories:
- **Backend (`app/.env`)**: Define `DATABASE_URL` (Postgres or local SQLite), `REDIS_URL`, and Africa's Talking API credentials.
- **ML (`ml/.env`)**: Set server ports and model weights paths.

### Step 4: Run the Services
Run the backend web app and the ML service simultaneously:
```bash
# Terminal 1: Run Backend
source .venv/bin/activate
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Terminal 2: Run ML Service
source .venv/bin/activate
PYTHONPATH=. uvicorn ml.main:app --reload --port 8001
```

---

## 3. Running Verification Tests
Execute the integration test suite to verify multi-tenant setups, vector matching, event streaming, and incident lifecycle flows:
```bash
source .venv/bin/activate
PYTHONPATH=. DATABASE_URL="sqlite:///./test.db" .venv/bin/python -m pytest
```
