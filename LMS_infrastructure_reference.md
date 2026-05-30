# YagnaTech LMS — Infrastructure Reference

> **Audience:** engineers + ops running YagnaTech LMS.
> **Status:** post-migration (AWS RDS/MySQL → Supabase; local uploads → R2 + Bunny Stream).
> **Target scale:** 1k–5k DAU now; architecture headroom documented to 10k DAU.
> Cross-references the schema in [DATABASE.md](YagnaTechOrg/DATABASE.md) and the SQL in [supabase/migrations/](YagnaTechOrg/supabase/migrations/).

---

## 1. Architecture at a glance

Microservices behind a single gateway. Each service owns its routes; all share one
Supabase Postgres instance (two schemas), Supabase Auth, and the same CDN/storage backends.

```
                         Users (students / admins / instructors)
                                        │
                        React SPA (Vite)  +  Flutter (future)
                                        │
                         Cloudflare CDN + WAF  (TLS, caching, DDoS)
                                        │
                    ┌───────────────────────────────────────────┐
                    │         Bastion gateway  (:8000)            │
                    │  CORS · rate-limit · Supabase JWT verify ·  │
                    │           HTTP proxy / routing              │
                    └───────────────────────────────────────────┘
            ┌───────────┬───────────┬──────────┬───────────┬──────────┬──────────┐
            ▼           ▼           ▼          ▼           ▼          ▼          ▼
        auth(:8001) course(:8002) assess(:8003) org(:8004) college(:8005) pay(:8006) admin(:8007)
            │           │           │          │           │          │          │
            └───────────┴───────────┴────┬─────┴───────────┴──────────┴──────────┘
                                         ▼
              ┌────────────────────────────────────────────────────────┐
              │  Supabase Postgres   (schemas: lucy_devdb · lms_admin)   │
              │  Supabase Auth       (auth.users — passwords, JWTs)      │
              └────────────────────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼──────────────────────────────┐
        ▼                                 ▼                              ▼
  Bunny Stream                     Cloudflare R2                    Sentry + Grafana
  (HLS video, ABR,                 (PDFs, images, thumbnails,       (errors, traces,
   signed playback)                 attachments, certs, exports)     uptime via /health)
```

### Port map (docker-compose)

| Service | In-container port | Behind Bastion as |
|---|---|---|
| bastion | 8000 | — (public entry) |
| auth-service | 8001 | `/api/v1/auth/*` |
| course-service | 8002 | `/api/v1/course/*` |
| assessment-service | 8003 | `/api/v1/assessment/*` |
| organization-service | 8004 | `/api/v1/org/*` |
| college-service | 8005 | `/api/v1/college/*` |
| payment-service | 8006 | `/api/v1/payment/*` |
| admin-service | 8007 | `/api/admin/*`, `/api/public/*` |

> In **local dev** (no Docker) admin-service defaults to `:5000` (its `env.port`), and the
> frontend admin screens call it directly via `VITE_ADMIN_API_URL`. In Docker it runs on
> 8007 behind Bastion. This split is intentional and pre-existing.

---

## 2. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite + Tailwind/shadcn | Flutter mobile is a future addition |
| Gateway | Express (Bastion) | CORS, rate-limit, JWT pre-check, proxy |
| Backend | Node.js + Express + Sequelize (×7 services) | NOT NestJS — kept the existing service code |
| Database | **Supabase Postgres** | one instance, schemas `lucy_devdb` + `lms_admin` |
| Auth | **Supabase Auth** | HS256 JWTs verified locally with `SUPABASE_JWT_SECRET` |
| Video | **Bunny Stream** | HLS, adaptive bitrate, transcoding, signed URLs |
| Files | **Cloudflare R2** | S3-compatible; served via `R2_PUBLIC_URL` |
| CDN/WAF | Cloudflare | in front of SPA + gateway |
| Cache | Upstash Redis | **planned, not wired** (see §9) |
| Queue | BullMQ + Redis | **planned**; admin-service has an in-DB email queue today |
| Monitoring | Sentry (errors/traces) + Grafana/uptime on `/health` | wired (DSN-guarded) |
| Hosting | Railway / Render / Hetzner | any Docker host; compose file included |
| Payments | Razorpay / Stripe | env slots reserved in payment-service |

---

## 3. Services & responsibilities

| Service | Owns | DB schema | Notes |
|---|---|---|---|
| **bastion** | gateway, routing, CORS, rate-limit, JWT pre-verify | — (no DB) | stateless |
| **auth-service** | signup/login/refresh/profile, roles | `lucy_devdb` | proxies to Supabase Auth |
| **course-service** | course catalog (canonical), enrollments | `lucy_devdb` | `courses`, `enrollments` |
| **assessment-service** | pre/post assessments, questions, registrations | `lucy_devdb` | seeds 40 AI questions on boot |
| **organization-service** | organisations CRUD | `lucy_devdb` | |
| **college-service** | colleges, branches | `lucy_devdb` | |
| **payment-service** | payments/subscriptions | `lucy_devdb` | gateway integration TBD |
| **admin-service** | LMS content (courses/lessons/quizzes/forums/certs/live classes), dashboards | `lms_admin` (+ cross-reads `lucy_devdb`) | holds 2 Sequelize handles; owns R2 + Bunny |

Every service exposes `GET /health` → `{ status: 'ok' }` for uptime probes.

---

## 4. Database

- **Engine:** Supabase Postgres. Two schemas preserved from the MySQL design:
  - `lucy_devdb` — identity, catalog, org tree, assessments (camelCase columns).
  - `lms_admin` — Laravel-style LMS content + progress (snake_case columns).
- **Schema source of truth:** [supabase/migrations/](YagnaTechOrg/supabase/migrations/) (`01`→`05`, or `06_apply_all.sql`). Apply via Supabase SQL Editor or `supabase db push`.
- **Connection:** every service reads `DATABASE_URL` (pooled, port 6543 for runtime; direct 5432 for migrations) and sets `DB_SCHEMA`. SSL is on (`rejectUnauthorized:false` for Supabase's cert chain).
- **Cross-schema:** admin-service uses a second Sequelize handle (`authDb`, schema `lucy_devdb`) for student/instructor/college reads. Both handles hit the same DB.

### MySQL → Postgres translation applied
| MySQL | Postgres |
|---|---|
| `dialect:'mysql'` + `mysql2` | `dialect:'postgres'` + `pg`/`pg-hstore` |
| camelCase unquoted | `"camelCase"` quoted in all raw SQL |
| `JSON` + `JSON_CONTAINS` | `JSONB` + `@>` (GIN-indexed) |
| `JSON_EXTRACT` / `JSON_SET` | `->` / `->>` / `jsonb_set` |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT (...) DO UPDATE` |
| `SHOW COLUMNS` / `DESCRIBE` | `information_schema.columns` |
| `MODIFY COLUMN` / `ENUM` widen | `ALTER COLUMN ... TYPE` + `ADD COLUMN IF NOT EXISTS` |
| `TINYINT(1)` | `BOOLEAN` |
| `LIKE` (case-insensitive) | `ILIKE` |
| `AUTO_INCREMENT` | `GENERATED BY DEFAULT AS IDENTITY` |

---

## 5. Authentication

- **Supabase Auth owns passwords.** auth-service `register`/`login`/`refresh`/`changePassword`
  call the Supabase JS SDK; the app keeps a profile row in `lucy_devdb.users` keyed on the
  legacy `userId`, with `supabase:<uid>` stashed in the `passwordHash` column as the
  JWT-subject → profile back-pointer.
- **Token verification is local.** Every service verifies the Supabase access token (HS256)
  with `SUPABASE_JWT_SECRET` via `jose` — no network round-trip per request. `req.user` keeps
  the legacy `{ id, email, role }` shape so controllers were untouched.
- **Admin/root break-glass login.** admin-service `AuthService.login` still issues a local JWT
  (signed with `JWT_SECRET`) for the bootstrap root/college admin stored in `lms_admin.users`.
  The admin middleware **dual-verifies**: Supabase token first, then the local admin JWT. This
  keeps admin login working even before any Supabase user exists.
- **Admin-created users** (students/instructors added in the admin UI) are created through
  `supabase.auth.admin.createUser()` + a profile row, with rollback if the profile write fails.

Required secrets per service: `SUPABASE_JWT_SECRET` (all), plus `SUPABASE_URL` +
`SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (auth-service + admin-service only).

---

## 6. Media & file storage

| Asset type | Backend | Code | Stored in DB as |
|---|---|---|---|
| Lesson videos | **Bunny Stream** | [BunnyStream.js](YagnaTechOrg/backend/admin-service/src/services/BunnyStream.js) | embed URL (or `bunny:<guid>`) |
| Images, PDFs, thumbnails, attachments, certs, exports | **Cloudflare R2** | [R2Storage.js](YagnaTechOrg/backend/admin-service/src/services/R2Storage.js) | public URL (or `uploads/<key>`) |

- The facade [fileUploader.js](YagnaTechOrg/backend/admin-service/src/helpers/fileUploader.js)
  preserves the old `upload()/removeFile()/niceFileName()` signature, so the 20+ existing call
  sites didn't change. It routes `video/*` mimetypes to Bunny, everything else to R2.
- The legacy `/uploads` static mount is now **conditional** — it only serves if the local
  uploads dir still exists, for pre-migration rows. Delete the dir post-cutover.

---

## 7. Monitoring & observability

- **Errors + traces:** Sentry. Each backend service self-inits Sentry via its
  `src/observability.js` (guarded by `SENTRY_DSN`; no-op when unset) and attaches the Express
  error handler. Frontend uses `@sentry/react` (init in [main.tsx](YagnaTechOrg/frontend/src/main.tsx)).
- **Uptime / health:** every service exposes `GET /health`. Point Grafana Cloud / UptimeKuma /
  Better Uptime at these.
- **Tuning:** `SENTRY_TRACES_SAMPLE_RATE` (default 0.1). For full Express auto-instrumentation,
  Sentry v8 prefers init before `express` is imported — the `observability` module is imported
  first in each entrypoint, so this is satisfied.
- **Logs/metrics (future):** ship container logs to Grafana Loki; add a `/metrics` Prometheus
  endpoint per service when you need request-level dashboards.

---

## 8. Environment variables

Each service has a `.env.example`. Copy to `.env` and fill in. Key groups:

| Group | Vars | Where |
|---|---|---|
| Database | `DATABASE_URL`, `DB_SCHEMA` (+ `AUTH_DB_SCHEMA`, `ASSESSMENT_DB_SCHEMA` in admin) | all DB services |
| Supabase Auth | `SUPABASE_JWT_SECRET` (all); `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auth + admin) | |
| R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | admin-service |
| Bunny | `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_CDN_HOSTNAME` | admin-service |
| Monitoring | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SERVICE_NAME` | all (+ `VITE_SENTRY_*` frontend) |
| Frontend | `VITE_BASTION_API_URL`, `VITE_ADMIN_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | frontend |

---

## 9. Scalability roadmap (1k → 10k DAU)

Architecture is sized for **1k–5k DAU now**, with these documented next steps as load grows:

1. **Add Upstash Redis** (cache + BullMQ). First win: move admin-service's in-memory
   `watchStore` (lesson progress) to Redis so admin-service can run multiple instances. Today
   it's single-instance-safe only.
2. **BullMQ workers** for email, certificate generation, payment webhooks, analytics — replace
   the current in-DB email queue.
3. **Postgres read replica** (Supabase) and route read-heavy catalog queries to it.
4. **Bump connection pools** on public-traffic services (course/admin) from default 5 → 20–30.
5. **H.265 + adaptive bitrate** on Bunny to cut the biggest cost driver (streaming bandwidth).
6. **Cloudflare cache rules** on public catalog endpoints to shed DB read load.

Indicative monthly infra cost (from the cost model): ~$170/mo @1k DAU → ~$820/mo @5k DAU →
~$1,930/mo @10k DAU. Biggest drivers: video streaming + CDN bandwidth.

---

## 10. Adding / removing features (this is a microservices product)

**Add a new microservice** (e.g. `notification-service`):
1. Copy an existing lightweight service (e.g. `organization-service`) as a template.
2. Reuse the DB config pattern (`DATABASE_URL` + `DB_SCHEMA`), the Supabase
   `isLoggedin.js` middleware, and `src/observability.js`.
3. Add a route block in Bastion (`backend/Bastion-server/src/routes`) + a port in
   `docker-compose.yml`.
4. New tables → add a `supabase/migrations/NN_*.sql` file; never hand-edit prod.

**Add a feature to an existing service:**
- New table/column → add a migration SQL file (preferred) or rely on the idempotent on-boot
  `ADD COLUMN IF NOT EXISTS` self-heal pattern already used in admin-service/assessment-service.
- New asset type → it already routes through R2 (non-video) or Bunny (video) via the
  fileUploader facade; no new storage wiring needed.

**Remove a feature:** delete the routes + service code; drop the table in a new migration.
Keep migrations append-only so environments stay reproducible.

---

## 11. Running it

1. Create a Supabase project → copy `DATABASE_URL` (pooled), `SUPABASE_URL`, anon +
   service_role keys, and the JWT secret.
2. Apply [supabase/migrations/](YagnaTechOrg/supabase/migrations/) `01`→`05` in the SQL Editor.
3. Create the R2 bucket + S3 API token; create the Bunny Stream library + API key.
4. `cp .env.example .env` in each service + frontend; fill in values.
5. `npm install` in each service (pulls `pg`, `@supabase/supabase-js`, `@aws-sdk/client-s3`,
   `jose`, `@sentry/node`, …) and the frontend.
6. `docker compose up` from `backend/`, or `npm run dev` per service + `npm run dev` in frontend.
7. Seed admins: `npm run seed:admin` (admin-service) etc.

---

## 12. Known follow-ups / tech debt

- `diag-*.js` scripts in admin-service are one-off diagnostics — updated to Postgres but not
  part of runtime.
- Old `backend/*/src/db/migrations/*.sql` (MySQL) are historical artifacts; the Supabase
  migrations are now authoritative.
- `program_enum` type is defined in migration `01` but the `program`/`selectedProgram` columns
  use `VARCHAR` (admins create program titles dynamically) — the enum is kept as documentation
  of the canonical values.
- `watchStore` is in-memory (single-instance). Redis migration is the gate for horizontal
  scaling of admin-service (see §9).

---

## 13. Provisioned Infrastructure (LIVE) — VR Robotics Academy

> Record of the actual cloud resources provisioned for this project.
> **Only non-secret identifiers are recorded here.** All secret keys / passwords /
> tokens / DSN live in **`credentials.env`** (gitignored) — edit there + run
> `node sync-credentials.js` to distribute. See **[CREDENTIALS.md](CREDENTIALS.md)**.
>
> Naming convention: all resources are prefixed **`vrrobotics-`**.

### 13.1 Resource inventory

| Layer | Provider | Resource name | Region | Endpoint / identifier (non-secret) | Status |
|---|---|---|---|---|---|
| Database + Auth | **Supabase** | project `VRLMS` | Seoul `ap-northeast-2` | `https://mchepezafejfyvjwlsya.supabase.co` · pooler `aws-1-ap-northeast-2.pooler.supabase.com:5432` | ✅ live |
| File storage | **Cloudflare R2** | bucket `vrrobotics-assets` | Asia-Pacific (auto) | account `3d41e964e8f87c96f433e4931e8ec8ef` · public `https://pub-35b9bf5306ea4018bb410638b90afe99.r2.dev` | ✅ live |
| Video | **Bunny Stream** | library `vrrobotics-videos` | global CDN | library ID `671923` · CDN `vz-8a0b8f61-e4d.b-cdn.net` | ✅ live (trial) |
| Monitoring | **Sentry** | org `vr-robotics-academy`, project `node` | US storage | issues at `vr-robotics-academy.sentry.io` | ✅ live |
| Cache / Queue | **Upstash Redis** | `vrrobotics-cache` | Mumbai `ap-south-1` | `grand-molly-138665.upstash.io:6379` (TLS) · free tier | ✅ provisioned (code wiring pending) |
| Payments | **Razorpay** | account (live) | India | Key ID `rzp_live_SYDFU4T2TTooyW` | ⚠️ Key ID only — secret deferred to launch |
| Email | SMTP | — | — | — | ⬜ not configured (optional) |
| Domain | Cloudflare DNS | `vrroboticsacademy.com` | — | registered/managed in Cloudflare | ✅ owned |

### 13.2 Auth specifics

- Supabase project uses the **new JWT Signing Keys (ES256, asymmetric)** — not legacy HS256.
- All service middlewares verify tokens via the **JWKS endpoint**
  (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`) with an HS256 fallback for legacy tokens.
- DB connection uses the **session pooler** (port 5432). The deprecated direct host
  (`db.<ref>.supabase.co`) is IPv4-paid-only and is NOT used.

### 13.3 Local run ports

| Service | Local port | Bastion route |
|---|---|---|
| Bastion gateway | 8000 | — |
| auth-service | 8001 | `/api/v1/auth/*` |
| course-service | 8002 | `/api/v1/course/*` |
| assessment-service | 8003 | `/api/v1/assessment/*` |
| organization-service | 8004 | `/api/v1/organisation/*` |
| college-service | 8005 | `/api/v1/college/*` |
| payment-service | 8006 | `/api/v1/payment/*` |
| admin-service | 5000 (local) | `/api/admin/*`, `/api/public/*` |
| frontend (Vite) | **8080** | — |

### 13.4 Seeded accounts (dev — change passwords before launch)

| Role | Email | Password | Lives in |
|---|---|---|---|
| Platform admin | `vradmin@vrroboticsacademy.com` | `VrAdmin@2026` | `lucy_devdb.users` + Supabase Auth |
| Root admin | `vrroot@vrroboticsacademy.com` | `VrRoot@2026` | `lms_admin.users` (bcrypt, local JWT) |

> Legacy dev seeds (`admin@gmail.com` / `root@admin.com`) still exist and work —
> safe to delete from Supabase Auth + the users tables once the branded ones verify.

### 13.5 Credential management workflow

1. Edit values in **`credentials.env`** (single source of truth).
2. Run `node sync-credentials.js` → distributes keys into every service `.env`
   (and the VITE_ public subset into `frontend/.env`).
3. Restart affected services (`.env` changes don't hot-reload).

### 13.6 Outstanding for full 5k-DAU readiness

- [ ] **Redis wiring** — move `watchStore` + email queue to BullMQ on Upstash (credential ready).
- [ ] **Razorpay secret + webhook secret** — at payment launch.
- [ ] **SMTP** — when transactional email is needed.
- [ ] **Cloudflare CDN/WAF** in front of frontend + Bastion (deploy-time).
- [ ] **Login redirect-loop fix** (in progress) — dashboard calls an unstarted service → 401 bounce.
- [ ] Change seeded admin passwords; rotate the live Razorpay key if it was ever exposed.
