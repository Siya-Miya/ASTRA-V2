# ASTRA V2

**Astronaut Health Monitoring & Decision-Support Platform**

ASTRA is an astronaut health monitoring and decision-support platform designed to support crew health awareness during space missions.

The platform combines simulated physiological monitoring, health reporting, alert management and a searchable knowledge-support system to help organise astronaut health information.

## Features

- **Crew Profiles:** Five astronaut profiles stored in the database.
- **Physiological Monitoring:** Simulated heart rate, oxygen saturation and body temperature readings.
- **Health Alerts:** Detects sustained heart-rate anomalies using configurable demonstration rules.
- **Health Reporting:** Allows crew members to submit symptoms and health observations.
- **ASTRA Assist:** Searches a structured knowledge base to provide relevant health information and guidance.
- **Anatomical Interface:** Interactive anatomical visualisation for exploring body regions and submitting health reports.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript, Three.js |
| Backend | Node.js, Express.js |
| Database | SQLite, better-sqlite3 |
| Knowledge Search | Fuse.js, JSON |
| Simulation | Node.js |

## Project Structure

```text
ASTRA-V2/
├── Backend/
│   ├── database/
│   ├── routes/
│   ├── services/
│   └── server.js
├── Frontend/
│   ├── css/
│   ├── js/
│   └── index.html
├── KnowledgeBase/
│   └── cards/
└── Simulator/
    └── sensorSimulator.js
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Siya-Miya/ASTRA-V2.git
cd ASTRA-V2
```

### 2. Install backend dependencies

```bash
cd Backend
npm install
```

### 3. Start the backend

```bash
node server.js
```

The API runs locally on port `3000`.

### 4. Start the sensor simulator

Open another terminal from the project root:

```bash
node Simulator/sensorSimulator.js
```

### 5. Launch the frontend

Open `Frontend/index.html` using the VS Code Live Server extension on port `5500`.

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | API status |
| GET | `/api/crew` | Retrieve crew profiles |
| GET | `/api/readings` | Retrieve sensor readings |
| POST | `/api/readings` | Submit sensor readings |
| GET | `/api/alerts` | Retrieve alerts |
| POST | `/api/health-reports` | Submit health reports |
| POST | `/api/knowledge/ask` | Search the knowledge base |

## Current Limitations

- Physiological readings are simulated; no physical medical sensors are currently connected.
- Alert thresholds are demonstration rules and are not clinically validated medical thresholds.
- ASTRA Assist uses structured knowledge-base search rather than a generative AI or full RAG system.
- The project is a prototype and is not certified for medical or operational use in spaceflight.
- Authentication, production deployment and automated testing are not yet implemented.

## Future Direction

ASTRA is intended to evolve into a more comprehensive crew health-support platform, with further development focused on:

- Improving the frontend architecture and anatomical interface.
- Expanding physiological monitoring and health reporting.
- Improving alert management and historical health analysis.
- Expanding the knowledge base and decision-support capabilities.
- Strengthening backend reliability, testing and deployment.

---

**ASTRA V2 — Supporting crew health awareness through software, data and decision support.**
