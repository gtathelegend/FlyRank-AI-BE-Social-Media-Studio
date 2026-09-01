# FlyRank Social Media Studio

Backend service for content ingestion, platform variant generation, multi-stage approval workflow, durable scheduling, and multi-platform publishing.

## 🚀 Phase 1 Status: DESIGN (Completed)

This repository is currently at **Phase 1 (Design Gate Passed)**. All architectural contracts, platform constraint profiles, data models, API endpoints, idempotency invariants, and adapter registries are defined and verified.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v20+ / v24+)
- **Language**: TypeScript
- **Web Framework**: Express
- **Database**: PostgreSQL 16
- **Queue / Scheduling**: BullMQ + Redis
- **Validation**: Zod
- **Testing**: Vitest
- **Containerization**: Docker Compose

---

## 🏗️ Architecture Overview

The system ingests blog content (URL or Markdown), generates platform-optimized variants (`discord`, `mock_x`, `mock_linkedin`), governs state transitions (`draft -> approved/rejected -> published`), and publishes via adapter interfaces.

```
SocialPublisher (Interface)
├── DiscordPublisher        (REAL - Discord Webhook Target)
├── MockXPublisher           (MOCK - X Preview Adapter)
└── MockLinkedInPublisher    (MOCK - LinkedIn Preview Adapter)
```

---

## ⚙️ Local Setup

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd flyrank-capstone-social-studio
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `.env` contains your development configuration.

### 3. Start Database & Redis (Docker)
```bash
docker compose up -d
```

---

## 🧪 Development Commands

- `npm run dev`: Start development server with live reload via `tsx`
- `npm run build`: Compile TypeScript codebase to `dist/`
- `npm test`: Execute Vitest automated tests

---

## 🔐 Environment Variables

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `3000` | Application HTTP server port |
| `NODE_ENV` | No | `development` | Environment mode (`development` / `production` / `test`) |
| `SOCIAL_ADAPTER` | No | `discord` | Active publisher adapter (`discord`, `mock_x`, `mock_linkedin`) |
| `DISCORD_WEBHOOK_URL` | Yes (for Discord) | - | Discord Webhook URL for real publication target |
| `POSTGRES_HOST` | No | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | No | `5432` | PostgreSQL port |
| `POSTGRES_DB` | No | `social_studio` | Database name |
| `POSTGRES_USER` | No | `postgres` | Database user |
| `POSTGRES_PASSWORD` | No | `postgres` | Database password |
| `REDIS_HOST` | No | `localhost` | Redis host for BullMQ |
| `REDIS_PORT` | No | `6379` | Redis port for BullMQ |
