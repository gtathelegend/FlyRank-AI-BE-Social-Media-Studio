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
- **Database**: PostgreSQL 16
- **Queue / Scheduling**: BullMQ + Redis
- **Validation**: Zod
- **Testing**: Vitest
- **Containerization**: Docker Compose

---

## 🔌 Publishing Adapters & Strategy Registry (Phase 4)

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

## 📡 API Endpoints (Phase 4 Additions)

### 1. Publish Approved Variant (`POST /variants/:id/publish`)
Executes publication via target social adapter, records publication attempt in DB ledger, and updates variant status to `published`.
- **Request Body**: `{ "slotId": "slot-uuid" }`
- **Response** (`200 OK`):
```json
{
  "attemptId": "att-123",
  "variantId": "var-456",
  "slotId": "slot-789",
  "status": "success",
  "isReplay": false,
  "externalPostId": "9876543210",
  "publishedAt": "2026-09-01T22:17:00.000Z",
  "url": null
}
```

### 2. Get Variant Publish Attempts (`GET /variants/:id/attempts`)
- **Response** (`200 OK`): Retransmits array of execution attempt ledger entries for the variant.

### 3. Inspect Publish Attempt (`GET /publish-attempts/:id`)
- **Response** (`200 OK`): Detailed attempt record.

---

## 🧪 Manual Discord Integration Test Instructions

To verify real Discord Webhook publishing locally:

1. Create a channel in your Discord server and create a Webhook integration URL.
2. Add the URL to your local `.env` file:
   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
   ```
3. Run the development server: `npm run dev`
4. Post a markdown document (`POST /posts`).
5. Generate variants (`POST /posts/:id/variants`).
6. Approve the Discord variant (`POST /variants/:id/approve`).
7. Publish the variant (`POST /variants/:id/publish`).
8. Verify message delivery in your Discord channel!
9. Repeat step 7 to verify idempotent replay (`isReplay: true`, zero duplicate Discord messages).

> [!CAUTION]
> NEVER commit `.env` or write Discord Webhook credentials into documentation, tests, logs, or evidence files.

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
