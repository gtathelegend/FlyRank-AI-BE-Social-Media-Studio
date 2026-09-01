# FlyRank Social Media Studio

Backend service for content ingestion, platform variant generation, multi-stage human review workflow, durable scheduling, and multi-platform publishing.

## 🚀 Status
- [x] **Phase 1: DESIGN (Completed)**
- [x] **Phase 2: CONTENT INGESTION + VARIANT GENERATION (Completed)**
- [x] **Phase 3: HUMAN APPROVAL WORKFLOW (Completed)**
- [x] **Phase 4: PUBLISHING ADAPTERS + IDEMPOTENT PUBLISHING (Completed)**
- [ ] Phase 5: END-TO-END VERIFICATION & HARDENING (Pending)

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v20+ / v24+)
- **Language**: TypeScript
- **Web Framework**: Express
- **Database**: PostgreSQL 16 (with auto-migration `001_initial_schema.sql`)
- **Queue / Scheduling**: BullMQ + Redis
- **Validation**: Zod
- **Testing**: Vitest
- **Containerization**: Docker Compose

---

## 🗄️ Database & Schema Setup

PostgreSQL is automatically initialized on application startup. When starting the development server (`npm run dev` or `npm start`), the application connects to PostgreSQL via `DATABASE_URL` and applies `src/db/migrations/001_initial_schema.sql` automatically.

### Start PostgreSQL & Redis Services
```bash
docker compose up -d
```

---

## 🔌 Publishing Adapters & Strategy Registry

```
SocialPublisher (Interface Contract)
├── DiscordPublisher        (REAL: Sends HTTP POST to DISCORD_WEBHOOK_URL)
├── MockXPublisher           (MOCK: Zero network requests, inspectable records)
└── MockLinkedInPublisher    (MOCK: Zero network requests, inspectable records)
```

Business logic resolves publisher adapters dynamically via `PublisherRegistry.getPublisher(platform)`. Setting `SOCIAL_ADAPTER=discord` or `SOCIAL_ADAPTER=mock_x` in `.env` swaps strategy implementation without modifying application logic.

---

## 🔒 Idempotent Publishing & Approval Invariants

$$\text{SAME VARIANT} + \text{SAME SLOT} = \text{EXACTLY ONE SUCCESSFUL PUBLICATION}$$

- **Approval Gate Guard**: `POST /variants/:id/publish` requires `variant.status === 'approved'`. Draft, rejected, or published variants are blocked with `409 Conflict`.
- **Database-Level Idempotency**: Derived `idempotency_key` (`${variantId}:${slotId}`) prevents duplicate execution under concurrent retries or repeated API calls. Duplicate requests return `isReplay: true` with the stored attempt record.

---

## 📡 API Workflow Summary

### 1. Ingest Content (`POST /posts`)
Flexibly supports Markdown or URL ingestion:
```json
{
  "sourceType": "markdown",
  "title": "FlyRank Discord E2E Test",
  "content": "This is an end-to-end test of the FlyRank Social Media Studio publishing pipeline."
}
```
*(Also supports `"body"` as an alias for `"content"` and defaults `sourceType` to `"markdown"` if omitted).*

### 2. Generate Variants (`POST /posts/:id/variants`)
Generates platform draft variants (`discord`, `mock_x`, `mock_linkedin`).

### 3. Approve Variant (`POST /variants/:id/approve`)
Validates platform constraints and transitions status to `approved`.

### 4. Create Scheduling Slot (`POST /variants/:id/schedule`)
```json
{
  "scheduledAt": "2026-09-05T12:00:00.000Z"
}
```

### 5. Publish to Real Discord Webhook (`POST /variants/:id/publish`)
Executes publication via `DiscordPublisher`, records attempt in PostgreSQL `publish_attempts` table, and updates status to `published`.

### 6. Idempotent Replay Verification (`POST /variants/:id/publish`)
Repeating the identical request returns `isReplay: true` with the stored execution attempt without re-calling the Discord webhook.

---

## ⚙️ Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run Vitest test suite (54 tests)
npm test

# Start live development server
npm run dev
```
