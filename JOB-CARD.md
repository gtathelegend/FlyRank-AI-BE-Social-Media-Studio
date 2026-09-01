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
  - Executed and passed 23 automated tests (0 errors).

- [ ] **Phase 3 — Review Workflow & Scheduling**
  - Implement variant approval/rejection endpoints (`POST /variants/:id/approve`, `POST /variants/:id/reject`).
  - Implement variant editing (`PUT /variants/:id`).
  - Implement variant scheduling (`POST /variants/:id/schedule`) enforcing unapproved variant guard.
  - Connect BullMQ queue for delayed publication jobs.

- [ ] **Phase 4 — Durable Worker & Adapters**
  - Build BullMQ background publication worker.
  - Implement real HTTP target execution for `DiscordPublisher` via `DISCORD_WEBHOOK_URL`.
  - Implement full mock publication recording for `MockXPublisher` and `MockLinkedInPublisher`.
  - Enforce database-level attempt ledger and idempotency handling.

- [ ] **Phase 5 — End-to-End Verification & Hardening**
  - End-to-end multi-platform integration tests.
  - Concurrent request deduplication & idempotency edge-case testing.
  - Final documentation, evidence collection, and repository cleanup.
