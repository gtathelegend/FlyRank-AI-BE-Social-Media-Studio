# FlyRank Social Media Studio

Backend service for content ingestion, platform variant generation, multi-stage approval workflow, durable scheduling, and multi-platform publishing.

## 🚀 Status
- [x] **Phase 1: DESIGN (Completed)**
- [x] **Phase 2: CONTENT INGESTION + VARIANT GENERATION (Completed)**
- [ ] Phase 3: REVIEW WORKFLOW + SCHEDULING (Pending)
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

## 🏗️ Content Pipeline (Phase 2)

```
URL / Markdown
    ↓
POST /posts (SSRF validation + Ingestion)
    ↓
Persist Canonical Source Post in DB
    ↓
POST /posts/:id/variants (Read from DB)
    ↓
Generate Platform-Specific Variants (Discord, Mock X, Mock LinkedIn)
    ↓
Validate Platform Constraint Profiles (Length, Tone, Hashtags)
    ↓
Persist Valid Draft Variants in DB
```

---

## 📡 API Surface (Phase 2 Endpoints)

### 1. Ingest Content (`POST /posts`)
- **Markdown Request**:
```json
{
  "sourceType": "markdown",
  "content": "# Article Title\n\nArticle body content...",
  "title": "Article Title"
}
```
- **URL Request**:
```json
{
  "sourceType": "url",
  "url": "https://example.com/blog/post"
}
```
- **Response** (`201 Created`):
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "sourceType": "markdown",
  "sourceUrl": null,
  "title": "Article Title",
  "sourceContent": "# Article Title...",
  "createdAt": "2026-09-01T22:10:00.000Z"
}
```

### 2. Get Stored Post (`GET /posts/:id`)
- **Response** (`200 OK`): Retransmits stored canonical post.

### 3. Generate Variants (`POST /posts/:id/variants`)
- **Response** (`201 Created`):
```json
{
  "postId": "123e4567-e89b-12d3-a456-426614174000",
  "variants": [
    {
      "id": "var-111",
      "postId": "123e4567-e89b-12d3-a456-426614174000",
      "platform": "discord",
      "content": "📢 **Article Title**\n\nArticle body...",
      "status": "draft",
      "validationInfo": {
        "isValid": true,
        "length": 150,
        "maxLength": 2000,
        "hashtagCount": 3,
        "maxHashtags": 3,
        "errors": []
      }
    }
  ]
}
```

### 4. Get Variant (`GET /variants/:id`)
- **Response** (`200 OK`): Single variant record.

---

## 🔒 SSRF Protection

`POST /posts` with `sourceType: "url"` enforces SSRF guard:
- Accepts only `http:` and `https:`.
- Blocks `localhost`, `127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`.
- Blocks internal TLDs (`.local`, `.internal`, `.lan`, `.localhost`).
- Caps request timeout (5s) and response payload size (2MB).

---

## ⚙️ Local Setup & Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run automated tests
npm test

# Start server
npm run dev
```
