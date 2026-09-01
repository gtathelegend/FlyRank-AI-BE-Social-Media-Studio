# FlyRank Social Media Studio

Backend service for content ingestion, platform variant generation, multi-stage human review workflow, durable scheduling, worker crash recovery, and multi-platform publishing.

## 🚀 Status
- [x] **Phase 1: DESIGN (Completed)**
- [x] **Phase 2: CONTENT INGESTION + VARIANT GENERATION (Completed)**
- [x] **Phase 3: HUMAN APPROVAL WORKFLOW (Completed)**
- [x] **Phase 4: PUBLISHING ADAPTERS + IDEMPOTENT PUBLISHING (Completed)**
- [x] **Phase 5: END-TO-END VERIFICATION & HARDENING (Completed)**

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v20+ / v24+)
- **Language**: TypeScript
- **Web Framework**: Express
- **Database**: PostgreSQL 16 (with auto-migrations `001_initial_schema.sql` and `002_scheduler.sql`)
- **Queue / Worker**: Durable PostgreSQL Scheduler Worker (`PublishWorker`) with `FOR UPDATE SKIP LOCKED`
- **Validation**: Zod
- **Testing**: Vitest
- **Containerization**: Docker Compose

---

## 🗄️ Database & Schema Setup

PostgreSQL is automatically initialized on application startup. When starting the API server or worker (`npm run dev`, `npm start`, `npm run worker`), the application connects to PostgreSQL via `DATABASE_URL` and applies all schema migrations in `src/db/migrations/` automatically.

### Migration Files
1. `src/db/migrations/001_initial_schema.sql`: Primary relational schema for `posts`, `variants`, `slots`, and `publish_attempts` idempotency ledger with `UNIQUE(variant_id, slot_id)`.
2. `src/db/migrations/002_scheduler.sql`: Durable job store (`scheduled_jobs`) with status tracking (`pending`, `processing`, `published`, `failed`), lease timestamps (`claimed_at`, `available_at`), and lookup indexes.

### Start PostgreSQL Services
```bash
docker compose up -d
```

---

## 🏗️ Scheduler Architecture & Job State Lifecycle

```
[ POST /variants/:id/schedule ]
            │
            ▼
┌─────────────────────────┐
│ status = 'pending'      │ ◄─── Exponential Backoff Retry (available_at)
└───────────┬─────────────┘
            │ Worker Claims (FOR UPDATE SKIP LOCKED)
            ▼
┌─────────────────────────┐
│ status = 'processing'   │
└───────────┬─────────────┘
            │
      ┌─────┴───────────────────────────────────┐
      │                                         │
      ▼ (Success / Replay)                      ▼ (Error / Lease Expired)
┌─────────────────────────┐             ┌─────────────────────────┐
│ status = 'published'    │             │ status = 'failed'       │
└─────────────────────────┘             └─────────────────────────┘
```

### Job States
- **pending**: Job is waiting for its `scheduled_at` and `available_at` timestamp.
- **processing**: Job has been claimed atomically by a worker using `SELECT ... FOR UPDATE SKIP LOCKED`.
- **published**: Publication succeeded and attempt is recorded in the idempotency ledger.
- **failed**: Job failed permanently (e.g. approval security violation or maximum retries exceeded).

---

## 🛡️ Worker Architecture & Crash Recovery Strategy

### Atomic Job Claiming
Workers poll for due jobs using PostgreSQL transactions with `FOR UPDATE SKIP LOCKED`:
```sql
WITH due AS (
  SELECT id FROM scheduled_jobs
  WHERE status = 'pending' AND scheduled_at <= NOW() AND available_at <= NOW()
  ORDER BY scheduled_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 10
)
UPDATE scheduled_jobs sj
SET status = 'processing', claimed_at = NOW(), updated_at = NOW()
FROM due WHERE sj.id = due.id
RETURNING sj.*;
```
This guarantees that concurrent workers will never claim or double-process the same job.

### Crash Recovery & Zero External Duplicates Guarantee
If a worker process is terminated mid-batch (e.g., node process crash, SIGKILL, server restart):
1. Jobs claimed by the terminated worker remain in `processing` state.
2. When a restarted worker runs, `recoverStaleJobs()` finds any jobs in `processing` state whose `claimed_at` timestamp exceeds the configurable lease timeout (`PROCESSING_LEASE_SECONDS=60`).
3. **Idempotency Ledger Verification**: Before returning a stale job to `pending`, the recovery worker inspects the PostgreSQL `publish_attempts` ledger for `(variant_id, slot_id)`.
   - If an attempt with `status = 'success'` ALREADY exists (meaning external publish succeeded right before the crash), the job is immediately marked as `published` **WITHOUT calling external APIs again**.
   - If no successful attempt exists, the job is returned to `pending` for safe re-execution.

This multi-layer safety model (`PublishWorker` lease recovery + `PublishingService` DB idempotency ledger) mathematically guarantees **ZERO duplicate external posts** under worker restarts.

---

## 🔄 Retry Strategy & Failure Handling

1. **Transient Failures**: Network timeouts or adapter execution errors increment `job.attempts` and schedule the job for retry with exponential backoff (`available_at = NOW() + 5s * 2^(attempts)`).
2. **Permanent Failures**:
   - Security/Approval violations (e.g. variant is unapproved or rejected) transition the job to `failed` immediately without retrying.
   - Jobs reaching `max_attempts` (default: 3) transition to `failed` with sanitized `last_error` details recorded.

---

## 🔌 Publishing Adapters & Strategy Registry

```
SocialPublisher (Interface Contract)
├── DiscordPublisher        (REAL: Sends HTTP POST to DISCORD_WEBHOOK_URL)
├── MockXPublisher           (MOCK: Zero network requests, inspectable records)
└── MockLinkedInPublisher    (MOCK: Zero network requests, inspectable records)
```

Business logic resolves publisher adapters dynamically via `PublisherRegistry.getPublisher(platform)`. Setting `SOCIAL_ADAPTER=discord` or `SOCIAL_ADAPTER=mock_x` in `.env` swaps strategy implementation cleanly.

---

## 📡 API Endpoints

### 1. Ingest Content (`POST /posts`)
```json
{
  "sourceType": "markdown",
  "title": "FlyRank Capstone Post",
  "content": "Content ingestion pipeline with SSRF validation."
}
```

### 2. Generate Variants (`POST /posts/:id/variants`)
Generates platform draft variants (`discord`, `mock_x`, `mock_linkedin`).

### 3. Approve Variant (`POST /variants/:id/approve`)
Validates platform constraints and transitions status from `draft` to `approved`.

### 4. Create Scheduling Slot (`POST /variants/:id/schedule`)
```json
{
  "scheduledAt": "2026-09-05T12:00:00.000Z"
}
```
Creates a scheduling `Slot` and inserts a `ScheduledJob` with status `'pending'`. Requires `variant.status === 'approved'`.

### 5. Manual Publish (`POST /variants/:id/publish`)
Executes publication immediately via the platform adapter, enforcing `assertVariantApprovedForScheduling`.

### 6. Publish History (`GET /publish-history` or `GET /publish-attempts`)
Returns all publication attempts sorted newest first. Redacts sensitive credentials/webhooks.

---

## ⚙️ Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run complete Vitest test suite (65 tests)
npm test

# Run API server (Terminal 1)
npm run dev

# Run Worker process (Terminal 2)
npm run worker:dev

# Run Real Discord & Worker Crash Recovery E2E Verification
npx tsx scratch/phase5_e2e.ts
```

---

## 🔒 Security & Environment Variables

- `.env` is strictly gitignored.
- Sensitive credentials (such as `DISCORD_WEBHOOK_URL`) exist only in environment variables.
- Internal stack traces and webhook secrets are redacted from API responses and history views.
- SSRF protection blocks private IPs (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and unsafe schemes during URL ingestion.
