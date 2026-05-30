# YagnaTech LMS — End-to-End Setup Guide

> Get the whole stack running: **Supabase** (DB + Auth), **Cloudflare R2** (files),
> **Bunny Stream** (video), 7 backend services + the React frontend.
> Follow the steps in order. Every credential you create maps to a specific
> `.env` variable — the mapping tables tell you exactly where each one goes.

---

## 0. Prerequisites

- **Node.js 18+** and npm (`node -v`)
- **Git**
- A **Supabase** account → https://supabase.com
- A **Cloudflare** account → https://dash.cloudflare.com (for R2)
- A **Bunny.net** account → https://bunny.net (for Bunny Stream)
- (Optional) **Docker Desktop** if you want `docker compose up`
- (Optional) **Supabase CLI** → `npm i -g supabase` (only needed for `db push`)

You can do the whole thing **free-tier** to start: Supabase free, R2 free 10GB, Bunny pay-as-you-go (~$1 min).

---

## 1. Supabase — Database + Auth

### 1.1 Create the project
1. https://supabase.com/dashboard → **New project**.
2. Name it (e.g. `yagnatech-lms`), set a strong **database password** (save it), pick a region close to your users.
3. Wait ~2 min for provisioning.

### 1.2 Collect the 5 credentials
Go to **Project Settings** (gear icon):

| In the dashboard | Copy this | Goes into env var |
|---|---|---|
| Settings → **Database** → Connection string → **URI** (tick "Use connection pooling", mode **Transaction**, port **6543**) | the full `postgresql://...:6543/postgres` string | `DATABASE_URL` |
| Settings → **API** → Project URL | `https://<ref>.supabase.co` | `SUPABASE_URL` / `VITE_SUPABASE_URL` |
| Settings → **API** → Project API keys → **anon public** | `eyJ...` | `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` |
| Settings → **API** → Project API keys → **service_role** | `eyJ...` (secret!) | `SUPABASE_SERVICE_ROLE_KEY` |
| Settings → **API** → **JWT Settings** → JWT Secret | the secret string | `SUPABASE_JWT_SECRET` |

> ⚠️ The **service_role** key bypasses all security. It goes ONLY in `auth-service/.env`
> and `admin-service/.env` — never in the frontend, never committed.

> In the pooled `DATABASE_URL`, the password placeholder is your DB password from step 1.1.
> Replace `[YOUR-PASSWORD]` in the copied string.

### 1.3 Apply the schema
**Option A — SQL Editor (no CLI):**
1. Dashboard → **SQL Editor** → **New query**.
2. Open each file under `YagnaTechOrg/supabase/migrations/` and run them **in order**:
   `01_schemas_and_enums.sql` → `02_lucy_devdb_tables.sql` → `03_lms_admin_tables.sql` →
   `04_indexes.sql` → `05_seed_roles.sql`. Paste each, click **Run**.

**Option B — Supabase CLI:**
```bash
cd YagnaTechOrg
supabase link --project-ref <your-ref>
supabase db push          # applies supabase/migrations/*
```

Verify: SQL Editor → run `select * from lucy_devdb.roles;` — you should see 4 rows.

### 1.4 Configure Auth
Dashboard → **Authentication**:
1. **Providers → Email**: enable it. For a fast start, set **Confirm email = OFF**
   (the backend creates users with `email_confirm: true`, so they're usable immediately).
2. **URL Configuration → Site URL**: `http://localhost:5173` (your frontend dev URL).
   Add your production domain later.
3. (Optional) **Sessions / JWT expiry**: defaults are fine (1h access, long refresh).

That's all Supabase needs. The backend talks to it via the SDK + verifies tokens locally
with `SUPABASE_JWT_SECRET`.

---

## 2. Cloudflare R2 — Files (PDFs, images, thumbnails, certificates)

### 2.1 Create the bucket
1. https://dash.cloudflare.com → **R2** → **Create bucket**.
2. Name it `yagnatech-assets` (matches the example). Pick a location hint near your users.

### 2.2 Create an S3 API token
1. R2 → **Manage R2 API Tokens** → **Create API token**.
2. Permissions: **Object Read & Write**, scope to your bucket.
3. Create → you'll see **Access Key ID**, **Secret Access Key**, and your **Account ID**
   (also visible on the R2 overview page). Copy all three.

### 2.3 Make assets publicly readable
You need a public URL to serve thumbnails/banners directly in the browser:
- **Easiest:** bucket → **Settings** → **Public access** → enable the **r2.dev** subdomain.
  You get `https://pub-xxxxxxxx.r2.dev`.
- **Production:** add a **Custom Domain** (e.g. `assets.yourdomain.com`) under the bucket's
  **Settings → Custom Domains** (requires the domain on Cloudflare DNS).

### 2.4 (Recommended) CORS for browser uploads/previews
Bucket → **Settings → CORS policy** → add:
```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://app.yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### 2.5 Credential mapping (all go in `admin-service/.env`)
| R2 value | env var |
|---|---|
| Account ID | `R2_ACCOUNT_ID` |
| Access Key ID | `R2_ACCESS_KEY_ID` |
| Secret Access Key | `R2_SECRET_ACCESS_KEY` |
| Bucket name | `R2_BUCKET_NAME` |
| Public URL (`pub-xxx.r2.dev` or custom domain) | `R2_PUBLIC_URL` |

> The S3 endpoint is built automatically as `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`
> — you don't set it manually.

---

## 3. Bunny Stream — Video

### 3.1 Create a video library
1. https://dash.bunny.net → **Stream** → **Add Video Library**.
2. Name it (e.g. `yagnatech-videos`), pick replication regions (more regions = wider CDN,
   slightly higher cost).

### 3.2 Collect the 3 credentials
In the library:
| In the dashboard | env var |
|---|---|
| The **Library ID** (number in the URL / library settings) | `BUNNY_STREAM_LIBRARY_ID` |
| **API** tab → **API Key** (the Stream library key, NOT the account key) | `BUNNY_STREAM_API_KEY` |
| **API** / **Hostnames** → the pull-zone CDN hostname (e.g. `vz-xxxxxxxx-xxx.b-cdn.net`) | `BUNNY_STREAM_CDN_HOSTNAME` |

These all go in `admin-service/.env`.

### 3.3 How video flows (already coded)
When an admin uploads a video lesson, [BunnyStream.js](YagnaTechOrg/backend/admin-service/src/services/BunnyStream.js):
1. `POST /library/{id}/videos` → creates a video, returns a GUID.
2. `PUT /library/{id}/videos/{guid}` → uploads the file.
3. Bunny transcodes + serves HLS. We store the **embed URL** in `lessons.lesson_src`.
The player renders the Bunny iframe / HLS URL — no extra work needed.

---

## 4. Fill in the `.env` files

For each folder, copy the example and edit:
```bash
# from YagnaTechOrg/
cp backend/auth-service/.env.example         backend/auth-service/.env
cp backend/course-service/.env.example        backend/course-service/.env
cp backend/assessment-service/.env.example    backend/assessment-service/.env
cp backend/college-service/.env.example       backend/college-service/.env
cp backend/organization-service/.env.example  backend/organization-service/.env
cp backend/payment-service/.env.example       backend/payment-service/.env
cp backend/admin-service/.env.example         backend/admin-service/.env
cp backend/Bastion-server/.env.example        backend/Bastion-server/.env
cp frontend/.env.example                       frontend/.env
```
(On Windows PowerShell use `Copy-Item src dst`.)

### Who needs what

| Variable | auth | course | assess | college | org | pay | admin | bastion | frontend |
|---|---|---|---|---|---|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| `DB_SCHEMA` | `lucy_devdb` | `lucy_devdb` | `lucy_devdb` | `lucy_devdb` | `lucy_devdb` | `lucy_devdb` | `lms_admin` | — | — |
| `SUPABASE_JWT_SECRET` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `SUPABASE_URL` | ✅ | — | — | — | — | — | ✅ | — | — |
| `SUPABASE_ANON_KEY` | ✅ | — | — | — | — | — | ✅ | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | — | — | — | — | ✅ | — | — |
| `R2_*` | — | — | — | — | — | — | ✅ | — | — |
| `BUNNY_STREAM_*` | — | — | — | — | — | — | ✅ | — | — |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | — | — | — | — | — | — | — | — | ✅ |
| `VITE_BASTION_API_URL` / `VITE_ADMIN_API_URL` | — | — | — | — | — | — | — | — | ✅ |
| `SENTRY_DSN` (optional) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | (`VITE_SENTRY_DSN`) |

> `SUPABASE_JWT_SECRET` must be **identical** in every service — they all verify the same tokens.

---

## 5. Install & run

### 5.1 Install dependencies
```bash
# backend — once per service
for d in auth-service course-service assessment-service college-service \
         organization-service payment-service admin-service Bastion-server; do
  (cd backend/$d && npm install)
done

# frontend
cd frontend && npm install && cd ..
```
(PowerShell: loop with `foreach ($d in @('auth-service',...)) { cd backend/$d; npm install; cd ../.. }`)

### 5.2 Run — local dev (each service in its own terminal)
```bash
cd backend/auth-service        && npm run dev   # :8001
cd backend/course-service      && npm run dev   # :8002
cd backend/assessment-service  && npm run dev   # :8003
cd backend/organization-service&& npm run dev   # :8004
cd backend/college-service     && npm run dev   # :8005
cd backend/payment-service     && npm run dev   # :8006
cd backend/admin-service       && npm run dev   # :5000 (local) 
cd backend/Bastion-server      && npm run dev   # :8000 (gateway)
cd frontend                    && npm run dev   # :5173
```

### 5.3 Run — Docker (one command)
```bash
cd backend
cp .env.example .env          # set BASTION_ALLOWED_ORIGINS
docker compose up --build
```
Compose reads each `./<service>/.env`, so fill those first. Admin runs on `:8007` behind Bastion here.

### 5.4 Seed the first admins

All three seed scripts are now Supabase-aware — the accounts they create can log in
immediately. **`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` must be set** in the relevant
`.env` before running.

```bash
# Root admin for the admin dashboard (lms_admin.users — bcrypt + local JWT break-glass path)
cd backend/admin-service && npm run seed:admin
#   → root@admin.com / password123

# Platform admin (lucy_devdb.users + Supabase Auth) — can log in via the public site
cd backend/auth-service && node src/scripts/seedAdmin.js
#   → admin@gmail.com / admin123

# College-scoped admin (optional) — pass email, password, name, collegeId
cd backend/auth-service && node src/scripts/seedCollegeAdmin.js college-admin@gmail.com college123 "College Admin" COLLEGE001
```

Each script is **idempotent** — re-running resets the password and re-links the Supabase
user. Change all default passwords after first login.

> The auth-service seed scripts create the Supabase Auth user **and** the `lucy_devdb.users`
> profile row (with `passwordHash = supabase:<uid>`), so login works end-to-end. You can also
> create users by signing up through the app or adding them in the admin UI.

---

## 6. Verify end-to-end

Run these in order — each proves one integration works:

1. **Services up:**
   ```bash
   curl http://localhost:8000/health       # bastion → {"status":"ok"}
   curl http://localhost:8001/health        # auth
   curl http://localhost:5000/api/health    # admin (local)
   ```
2. **DB + Auth (signup):**
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@demo.com","password":"test1234","name":"Test","phone":"9999999999","dob":"2000-01-01","gender":"male"}'
   ```
   Expect `201` with `accessToken`. Check Supabase → Authentication → Users: the user appears.
   Check Table editor → `lucy_devdb.users`: a profile row exists with `passwordHash = supabase:<uid>`.
3. **Login:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@demo.com","password":"test1234"}'
   ```
   Expect `200` + tokens.
4. **R2 upload:** log into the admin UI, add a course with a thumbnail. The image should load
   from your `R2_PUBLIC_URL` (check the network tab — the URL is `https://pub-xxx.r2.dev/...`).
   Confirm the object appears in the R2 bucket.
5. **Bunny video:** add a video lesson in the curriculum builder. After upload, the lesson plays
   via the Bunny CDN; the video appears in your Bunny Stream library.
6. **Frontend:** open http://localhost:5173, sign up/login through the UI, browse the catalog.

If all 6 pass, the stack is fully wired end-to-end.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `password authentication failed` / connection timeout | wrong `DATABASE_URL` or password placeholder not replaced | re-copy the pooled URI; replace `[YOUR-PASSWORD]` |
| `relation "users" does not exist` | migrations not applied, or wrong `DB_SCHEMA` | run `supabase/migrations/*` in order; check schema value |
| `Auth not configured (SUPABASE_JWT_SECRET missing)` | secret not set / differs between services | set the **same** `SUPABASE_JWT_SECRET` everywhere |
| Login returns `Profile not provisioned` | auth user exists but no `lucy_devdb.users` row | register through the app (creates both), or backfill the row |
| `401 Invalid token` after login | frontend hitting service with a stale/clock-skewed token, or wrong JWT secret | confirm secret matches Supabase JWT Settings; re-login |
| Admin login fails but student login works | admin uses the local JWT path; `JWT_SECRET` unset in admin-service | set `JWT_SECRET` in `admin-service/.env` |
| Image upload 500 / `R2 not configured` | missing `R2_*` vars | fill all 5 R2 vars in `admin-service/.env` |
| Thumbnail uploads but doesn't display | `R2_PUBLIC_URL` not set or bucket not public | enable r2.dev subdomain or custom domain; set `R2_PUBLIC_URL` |
| Video upload 500 / `BUNNY_STREAM_API_KEY not configured` | missing Bunny vars | fill the 3 Bunny vars; use the **library** API key |
| CORS error in browser | origin not allowed | add your origin to `BASTION_ALLOWED_ORIGINS` + R2 CORS + Supabase Site URL |
| Sentry noise / "DSN" warnings | DSN unset (expected in dev) | leave `SENTRY_DSN` blank — it's a no-op |

---

## 8. Going to production (checklist)

- [ ] Separate Supabase project for prod; rotate all keys.
- [ ] Frontend behind **Cloudflare** (CDN + WAF). Backend behind it too.
- [ ] Set every `*_ALLOWED_ORIGINS` / Site URL to the real domain (no `*`).
- [ ] R2 **custom domain** instead of `r2.dev`.
- [ ] Bunny Stream: enable **token authentication** (signed playback URLs) for paid content.
- [ ] Set `NODE_ENV=production`, real `SENTRY_DSN`, and a low-but-nonzero `SENTRY_TRACES_SAMPLE_RATE`.
- [ ] Add **Upstash Redis** + move `watchStore` off in-memory before running >1 admin-service instance (see [LMS_infrastructure_reference.md §9](YagnaTechOrg/LMS_infrastructure_reference.md)).
- [ ] Point uptime monitoring (Grafana/UptimeKuma) at each `/health`.
- [ ] Use the **direct** (5432) `DATABASE_URL` only for migrations; **pooled** (6543) for runtime.

---

*See [LMS_infrastructure_reference.md](YagnaTechOrg/LMS_infrastructure_reference.md) for the as-built
architecture, and [DATABASE.md](YagnaTechOrg/DATABASE.md) for the full schema.*
