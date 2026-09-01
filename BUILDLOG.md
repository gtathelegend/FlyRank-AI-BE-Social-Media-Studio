# Build Log — Social Media Studio

## Phase 1 — Design Phase (2026-09-01)
- Initialized technical architecture, database schema, publisher adapter strategy registry, and Phase 1 test suite.

---

## Phase 2 — Content Ingestion + Variant Generation (2026-09-01)
- Implemented `POST /posts` (Markdown/URL ingestion with SSRF protection) and `POST /posts/:id/variants` generating platform-specific draft variants validated against platform constraint profiles.

---

## Phase 3 — Human Approval Workflow (2026-09-01)
- Implemented review gate (`approve`, `reject`, `edit`), status reset to `draft` on edit, audit history logging, and `assertVariantApprovedForScheduling` security guard.

---

## Phase 4 — Publishing Adapters + Idempotent Publishing (2026-09-01)
- Implemented `DiscordPublisher` (real HTTP webhook POST execution with 5s timeout), `MockXPublisher`, `MockLinkedInPublisher`, `PublisherRegistry`, database-level idempotency ledger, and `POST /variants/:id/publish`.

---

## Phase 4 E2E Repair & Diagnostic Fix (2026-09-01)

### Root Cause Analysis
1. **Request Schema Inflexibility**: `POST /posts` expected `content` and required `sourceType`. Requests sending `body` without `sourceType` failed Zod parsing.
2. **Error Handler Status Code**: Malformed JSON or Zod parse errors in unhandled paths fell through to the global 500 error handler in `src/app.ts` instead of returning `400 Bad Request`.
3. **Database Connectivity & Migration**: `src/db/db.ts` was created to connect to PostgreSQL 16 (`social_studio_postgres`) and automatically apply `src/db/migrations/001_initial_schema.sql` on server startup.
4. **Idempotency Replay Execution Order**: In `PublishingService.publishVariant`, checking the DB idempotency ledger before performing approval assertions allowed duplicate/retry publish requests to return `isReplay: true` cleanly without throwing status transition errors on already-published variants.

### E2E Diagnostic Steps & Verification
1. Created PostgreSQL connection pool & auto-migration runner in `src/db/db.ts`.
2. Updated `createPostSchema` to accept `body` as an alias for `content` and default `sourceType` to `markdown` or `url`.
3. Updated `app.ts` middleware to handle body-parser JSON syntax errors as HTTP 400.
4. Updated `PublishingService.publishVariant` to check DB idempotency ledger before approval guard for idempotent replay.
5. Executed `scratch/e2e_verify.ts`: Post created -> Variants generated -> Discord variant approved -> Slot created -> Real Discord webhook message delivered -> Duplicate request returned `isReplay: true`.
6. Executed `npm run build` (0 TypeScript errors) and `npm test` (54/54 tests passed).
