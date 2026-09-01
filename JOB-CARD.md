# FlyRank Capstone Job Card — Social Media Studio

## Capstone Progress Tracking

- [x] **Phase 1 — Design**
  - Configured platform constraint profiles (`discord`, `mock_x`, `mock_linkedin`).
  - Defined platform-independent `SocialPublisher` interface signature.
  - Designed relational PostgreSQL schema with `UNIQUE(variant_id, slot_id)` idempotency constraint.
  - Specified API endpoints, state transition constraints, and BullMQ durable scheduling architecture.
  - Built adapter strategy registry (`DiscordPublisher`, `MockXPublisher`, `MockLinkedInPublisher`).
  - Executed and verified build and automated test suite.

- [x] **Phase 2 — Content Ingestion & Variant Generation**
  - Implemented `POST /posts` accepting Markdown and URL ingestion.
  - Implemented SSRF security protection rejecting loopback, private IPs, internal domains, and unsafe schemes.
  - Built canonical post repository ensuring stored DB post is single source of truth.
  - Built `POST /posts/:id/variants` generating platform-adapted draft variants.
  - Implemented constraint validation service (`maxLength`, `tone`, `maxHashtags`) against `platformConstraints.ts`.
  - Executed and passed automated tests.

- [x] **Phase 3 — Review Workflow & Scheduling**
  - Implemented variant approval endpoint (`POST /variants/:id/approve`) validating constraints before approving.
  - Implemented variant rejection endpoint (`POST /variants/:id/reject`) persisting rejection reasons.
  - Implemented variant editing (`PUT /variants/:id`) forcing status reset to `draft` for re-approval.
  - Implemented scheduling foundation (`POST /variants/:id/schedule`) with mandatory security guard `assertVariantApprovedForScheduling`.
  - Built chronological audit history logging (`GET /variants/:id/history`).
  - Executed and passed automated tests.

- [x] **Phase 4 — Durable Worker & Adapters**
  - Built real HTTP target execution for `DiscordPublisher` via `DISCORD_WEBHOOK_URL` with 5s timeout and non-2xx error handling.
  - Built `MockXPublisher` and `MockLinkedInPublisher` adapters with zero network calls and inspectable records.
  - Implemented dynamic strategy resolution via `PublisherRegistry`.
  - Enforced approval guard (`variant.status === 'approved'`).
  - Implemented database-level idempotency ledger ensuring `SAME VARIANT + SLOT = 1 PUBLICATION` with `isReplay: true` replay responses.
  - Built `POST /variants/:id/publish`, `GET /variants/:id/attempts`, and `GET /publish-attempts/:id`.
  - Executed and passed 54 automated tests (0 errors).

- [x] **Phase 5 — End-to-End Verification & Hardening**
  - Created PostgreSQL durable scheduler migration (`002_scheduler.sql`) creating `scheduled_jobs` table.
  - Implemented `PublishWorker` daemon with atomic claiming (`FOR UPDATE SKIP LOCKED`), exponential backoff retries, and crash recovery.
  - Built stale job lease recovery mechanism verifying `publish_attempts` idempotency ledger to guarantee zero duplicate external posts on worker process restarts.
  - Implemented `GET /publish-history` and `GET /publish-attempts` API endpoints with secret URL redaction.
  - Created comprehensive Phase 5 test suite (`tests/phase5.test.ts`) bringing total automated suite to 65 passing tests (0 errors).
  - Verified end-to-end real Discord webhook publishing, worker crash recovery, and idempotency replay via `scratch/phase5_e2e.ts`.

