# Railway Deploy Guide (turnkey, for ~10k students)

Deploy only what's on the canonical path. Each backend service = one Railway
service with its **Root Directory** set to the subfolder. Managed services
(Supabase Postgres, Upstash Redis, Bunny Stream, Cloudflare R2) stay external —
they carry the heavy load.

---

## What to deploy

| Railway service | Root dir | Build | Start | Public? | Notes |
|---|---|---|---|---|---|
| **admin-service** | `backend/admin-service` | `npm ci` | `npm start` | **Yes** | Browser hits `/api/public` + `/api/admin`. The core. |
| **Bastion (gateway)** | `backend/Bastion-server` | `npm ci` | `npm start` | **Yes** | Browser hits `/api/v1`; proxies to auth. |
| **auth-service** | `backend/auth-service` | `npm ci` | `npm start` | Private (behind Bastion) | Login / JWT. |
| **frontend** | `frontend` | `npm ci && npm run build` | static `dist/` | **Yes** | SPA. Easiest on **Vercel/Netlify**; or Railway static. |

**Skip / deploy only if actually used (legacy or not on hot path):**
`course-service`, `organization-service`, `assessment-service`, `payment-service`
(the empty one), `college-service`. Don't deploy these for the student flow.

> Every service must listen on **`process.env.PORT`** (Railway injects it).
> admin-service already does (`PORT || 5000`); confirm the others bind `PORT`.

---

## Environment variables (set in Railway → each service → Variables)

**admin-service** (the big one):
```
NODE_ENV=production
JWT_SECRET=<long random — boot FAILS in prod if weak>
SUPABASE_JWT_SECRET=<from Supabase>
DATABASE_URL=<Supabase POOLER url: ...pooler.supabase.com:6543/postgres>
REDIS_URL=<Upstash rediss://...>            # caching (already used)
BUNNY_STREAM_LIBRARY_ID / API_KEY / CDN_HOSTNAME
BUNNY_STREAM_TOKEN_KEY=<pull-zone token key>  # turns ON signed playback
R2_*  (account, bucket, keys)
SMTP_* + LMS_LOGIN_URL=https://<your-frontend>/login
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
APP_URL=https://<admin-service-public-url>
```
**auth-service:** its existing `.env` (Supabase URL, `SUPABASE_JWT_SECRET`, `DATABASE_URL`). Binds `PORT` ✅.

**Bastion (gateway)** — routes `/api/v1/<svc>` to each service via an env-driven
registry ([serviceMap.js](backend/Bastion-server/src/utils/serviceMap.js)). Set the hosts/ports of whatever you deploy
(use Railway **internal** hostnames):
```
PORT is injected by Railway (Bastion now binds PORT first ✅)
SUPABASE_URL / SUPABASE_JWT_SECRET
AUTH_SERVICE_HOST=<auth internal host>   AUTH_SERVICE_PORT=<auth port>
ADMIN_SERVICE_HOST=<admin internal host> ADMIN_SERVICE_PORT=<admin port>
BASTION_ALLOWED_ORIGINS=https://<frontend-url>   # CORS
# Only if you actually deploy them: COURSE_/ASSESSMENT_/ORGANISATION_/COLLEGE_/PAYMENT_SERVICE_HOST+PORT
```
**Skippable confirmed:** the frontend's `CourseProvider` call to Bastion
`/course/all` (course-service) feeds a context array that is **not used anywhere**
— if course-service isn't deployed, that call just fails gracefully. So you can
launch with only admin + auth + Bastion + frontend.

**frontend (build-time):**
```
VITE_ADMIN_API_URL=https://<admin-service-public-url>
VITE_BASTION_API_URL=https://<bastion-public-url>
```

---

## Database connection pooling (critical at scale)
- Use the **Supabase pooler** endpoint (port 6543) in `DATABASE_URL` — you already do ✅.
- Keep each instance's Sequelize pool **small** (max ~5–10). Math: `services × replicas × pool ≤ pooler limit`. With 2 services × 3 replicas × 5 = 30 connections — safe. Don't run big pools on many replicas.

## Scaling for ~10k students
- 10k *registered* is easy. Peak *concurrent* is maybe 1–2k.
- Start with **2–3 replicas of admin-service**, **1–2 of Bastion + auth**. Watch CPU/mem and scale admin-service horizontally (it's stateless now — in-memory caches are bounded + non-authoritative).
- Redis (Upstash) absorbs hot reads (leaderboard, catalog) ✅. Bunny absorbs video ✅.

## Healthchecks (Railway → service → Settings)
- admin-service: `GET /api/health`
- auth-service: `GET /health`  ·  Bastion: `GET /health`
- Set restart-on-failure. Graceful shutdown (SIGTERM) is already handled.

---

## Go-live switches (the last 2 scale items)
1. **Bunny signed playback** — set `BUNNY_STREAM_TOKEN_KEY` (Bunny dashboard → pull zone → Security → URL Token Authentication, enable it). Playback URLs then expire (6h) → no shared-link bandwidth theft. (Code is wired; inert until the key is set.)
2. **Razorpay webhook** — Razorpay dashboard → Webhooks → `https://<admin-service-url>/api/public/payments/webhook`, events `payment.captured` + `payment.failed`, secret = `RAZORPAY_WEBHOOK_SECRET`.

## CI before deploy
`.github/workflows/ci.yml` runs unit tests + frontend build on push. Connect the
GitHub repo to Railway for auto-deploy on green main.

---

## Smoke test after deploy
1. `GET https://<admin>/api/health` → `{ok:true}`
2. Log in as admin → create a course → assign to a teacher.
3. Teacher releases a lesson → student sees it; locked lesson's video URL is empty.
4. Buy a paid course (Razorpay test mode) → appears in My Courses.
5. Leaderboard loads (2nd load served from Redis).
