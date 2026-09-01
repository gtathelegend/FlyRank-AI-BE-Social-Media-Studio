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
  - Executed and passed 41 automated tests (0 errors).

- [ ] **Phase 4 — Durable Worker & Adapters**
  - Build BullMQ background publication worker.
  - Implement real HTTP target execution for `DiscordPublisher` via `DISCORD_WEBHOOK_URL`.
  - Implement full mock publication recording for `MockXPublisher` and `MockLinkedInPublisher`.
  - Enforce database-level attempt ledger and idempotency handling.

- [ ] **Phase 5 — End-to-End Verification & Hardening**
  - End-to-end multi-platform integration tests.
  - Concurrent request deduplication & idempotency edge-case testing.
  - Final documentation, evidence collection, and repository cleanup.
