# FlyRank Social Media Studio

Backend service for content ingestion, platform variant generation, multi-stage human review workflow, durable scheduling, and multi-platform publishing.

## 🚀 Status
- [x] **Phase 1: DESIGN (Completed)**
- [x] **Phase 2: CONTENT INGESTION + VARIANT GENERATION (Completed)**
- [x] **Phase 3: HUMAN APPROVAL WORKFLOW (Completed)**
- [ ] Phase 4: DURABLE WORKER + ADAPTERS (Pending)
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

## 🚦 Human Approval & Review Workflow (Phase 3)

```
[ draft ] ───(Approve)───► [ approved ] ───(Schedule)───► [ scheduled ] (Slot created)
    │                            │
 (Reject)                  (Edit content)
    ▼                            │
[ rejected ] ◄───────────────────┘ (Resets status back to draft for re-approval)
```

### Critical Security Rule:
**UNAPPROVED VARIANTS CAN NEVER BE SCHEDULED OR PUBLISHED.**
The service layer explicitly enforces `assertVariantApprovedForScheduling(variant)`. Any attempt to schedule a `draft`, `rejected`, or `published` variant is rejected with `409 Conflict`.

---

## 📡 API Endpoints (Phase 3 Additions)

### 1. Approve Variant (`POST /variants/:id/approve`)
Validates that variant is in `draft` status and passes platform constraint profile checks before transitioning status to `approved`.
- **Response** (`200 OK`):
```json
{
  "id": "var-123",
  "postId": "post-456",
  "platform": "discord",
  "status": "approved",
  "updatedAt": "2026-09-01T22:13:00.000Z"
}
```

### 2. Reject Variant (`POST /variants/:id/reject`)
Transitions status from `draft` to `rejected` and records optional rejection reason.
- **Request Body**: `{ "reason": "Brand tone mismatched" }`
- **Response** (`200 OK`):
```json
{
  "id": "var-123",
  "status": "rejected",
  "rejectionReason": "Brand tone mismatched",
  "updatedAt": "2026-09-01T22:13:00.000Z"
}
```

### 3. Edit Variant (`PUT /variants/:id`)
Edits variant content, re-validates platform constraints, and resets status to `draft` (forcing re-approval). Editing published content is forbidden.
- **Request Body**: `{ "content": "Updated content..." }`
- **Response** (`200 OK`): Retransmits updated variant in `draft` status.

### 4. Schedule Variant (`POST /variants/:id/schedule`)
Creates a schedule `Slot` entry for approved variants.
- **Request Body**: `{ "scheduledAt": "2026-09-05T12:00:00.000Z" }`
- **Response** (`201 Created`):
```json
{
  "id": "slot-789",
  "variantId": "var-123",
  "scheduledAt": "2026-09-05T12:00:00.000Z",
  "status": "scheduled",
  "createdAt": "2026-09-01T22:13:00.000Z"
}
```

### 5. Audit History (`GET /variants/:id/history`)
Returns timestamped log of review operations (`previousStatus`, `newStatus`, `reason`, `createdAt`).

---

## ⚙️ Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Run Vitest test suite (41 tests)
npm test

# Start live development server
npm run dev
```
