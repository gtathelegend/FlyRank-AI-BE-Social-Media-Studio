# Build Log — Social Media Studio

## Phase 1 — Design Phase (2026-09-01)
- Initialized technical architecture, data model, strategy pattern publisher adapters, Zod schemas, platform constraint profiles, and base Vitest test suite.

---

## Phase 2 — Content Ingestion + Variant Generation (2026-09-01)

### AI Assistance Disclosure
Phase 2 content pipeline, SSRF security guard, database repositories, constraint validator, and variant generator were implemented and verified using AI pair-programming (Antigravity AI Agent).

### Chronological Implementation Steps
1. **SSRF Guard & Security (`src/services/ssrfGuard.ts`)**:
   - Implemented `validateUrlForSsrf` enforcing protocol restriction (`http/https`), hostname blacklist (`localhost`, `.local`, `.internal`, `.lan`), and IP range blacklist (loopback, 10.x, 172.16-31.x, 192.168.x, 169.254.x, IPv6 `::1`).
2. **URL Ingestion Service (`src/services/urlIngestionService.ts`)**:
   - Built HTML scraper with 5000ms request timeout and 2MB payload size limit.
   - Extracted title and sanitized text content.
3. **Repository Layer (`src/services/postRepository.ts`)**:
   - Created database data access layer for canonical post storage and variant persistence.
4. **Constraint Validator (`src/services/constraintValidator.ts`)**:
   - Built reusable validation service validating max length, hashtag count, and non-empty content against `platformConstraints.ts`.
5. **Variant Generator (`src/services/variantGenerator.ts`)**:
   - Built deterministic platform-specific formatter generating `draft` status variants for `discord`, `mock_x`, and `mock_linkedin`.
6. **Controllers & Endpoints**:
   - Built `PostController` (`POST /posts`, `GET /posts/:id`, `POST /posts/:id/variants`, `GET /variants/:id`).
   - Wired `postRouter` into Express app.
7. **Automated Testing & Verification**:
   - Created `tests/phase2.test.ts` with 17 unit/integration tests covering ingestion, SSRF protection, post retrieval, variant generation, and constraint validation.
   - Executed `npm run build` (0 TypeScript errors) and `npm test` (23/23 tests passed).
