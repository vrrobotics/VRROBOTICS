# VR Robotics Academy — Credentials & API Inventory

> Single source of truth for every external integration. Edit values in
> **[credentials.env](credentials.env)**, then run `node sync-credentials.js`
> to push them into all service `.env` files.
>
> Mapped against [LMS_infrastructure_reference.md](LMS_infrastructure_reference.md).
> Target: **5,000 DAU** without compromise.

---

## Status overview

| # | Layer | Service / Provider | Status | Code wired? | Blocks 5k DAU? |
|---|---|---|---|---|---|
| 1 | Database | Supabase Postgres | ✅ SET | ✅ yes | — |
| 2 | Auth | Supabase Auth | ✅ SET | ✅ yes | — |
| 3 | File storage | Cloudflare R2 | ❌ MISSING | ✅ yes | **Yes** (uploads break) |
| 4 | Video | Bunny Stream | ❌ MISSING | ✅ yes | **Yes** (video lessons break) |
| 5 | Payments | Razorpay | ⚠️ PARTIAL | ⚠️ check flow | Only if selling paid courses |
| 6 | Cache / Queue | Upstash Redis + BullMQ | ❌ MISSING | ❌ **not wired** | **Yes** at multi-instance |
| 7 | Monitoring | Sentry | ❌ MISSING | ✅ yes | No (but strongly advised) |
| 8 | Email | SMTP | ❌ MISSING | ✅ yes | No (emails just no-op) |
| 9 | CDN / WAF | Cloudflare | ⏸️ infra | n/a | At scale (edge cache) |

Legend: ✅ done · ⚠️ partial · ❌ missing · ⏸️ infra-level (no key in repo)

---

## 1 & 2 — Supabase (Database + Auth) ✅ DONE

Everything set and verified (`testLogin.js` confirmed signInWithPassword works).

| Key | Where used |
|---|---|
| `DATABASE_URL` | all 7 backend services (Sequelize) |
| `SUPABASE_URL` | all backend + frontend |
| `SUPABASE_ANON_KEY` | auth + admin + frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | auth + admin (server-only) |
| `SUPABASE_JWT_SECRET` | all backend + Bastion (verify tokens) |

> Uses the **session pooler** (`aws-1-ap-northeast-2`, Seoul) on port 5432.
> New JWT signing keys (ES256) — middleware verifies via JWKS.

---

## 3 — Cloudflare R2 (assets) ❌ MISSING — **needed for 5k DAU**

Stores PDFs, thumbnails, banners, attachments, certificates, exports.
Code is ready ([R2Storage.js](backend/admin-service/src/services/R2Storage.js)) — just needs keys.

**Get the keys:**
1. https://dash.cloudflare.com → **R2** → **Create bucket** → name `vrrobotics-assets`
2. **R2 → Manage R2 API Tokens → Create API token** → "Object Read & Write"
3. Copy: **Account ID**, **Access Key ID**, **Secret Access Key**
4. Bucket → **Settings → Public access** → enable **r2.dev** subdomain → copy URL

**Fill in `credentials.env`:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

---

## 4 — Bunny Stream (video) ❌ MISSING — **needed for 5k DAU**

Stores + streams lesson videos (HLS, adaptive bitrate, CDN).
Code is ready ([BunnyStream.js](backend/admin-service/src/services/BunnyStream.js)).

**Get the keys:**
1. https://dash.bunny.net → **Stream → Add Video Library** → name `vrrobotics-videos`
2. In the library: **API** tab → copy **Library ID** + **API Key**
3. Copy the CDN **hostname** (`vz-xxxxxxxx-xxx.b-cdn.net`)

**Fill in `credentials.env`:** `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_CDN_HOSTNAME`

---

## 5 — Razorpay (payments) ⚠️ PARTIAL

| Key | Status |
|---|---|
| `RAZORPAY_KEY_ID` | ✅ set (`rzp_live_SYDFU4T2TTooyW` — **LIVE, real money**) |
| `RAZORPAY_KEY_SECRET` | ❌ missing — dashboard only |
| `RAZORPAY_WEBHOOK_SECRET` | ❌ missing — dashboard only |

**Get the rest:** dashboard.razorpay.com → **Settings → API Keys** (Generate → copy secret once) and **Settings → Webhooks** (create → copy webhook secret).

> ⚠️ Use a **Test Mode** key (`rzp_test_...`) for development. Only needed if you sell paid courses; free LMS works without it.
> 🔎 **Wiring to verify:** confirm payment-service has order-create + signature-verify routes before going live.

---

## 6 — Upstash Redis + BullMQ ❌ MISSING — **needed to scale past 1 instance**

This is the one item from the infra reference that is **not yet wired in code**.
Today: admin-service keeps lesson progress in an **in-memory `watchStore`** and
runs the email queue from a **DB table** — both fine for a single instance, but
they block running 2+ admin-service instances (each would have a divergent cache).

**For 5k DAU you'll likely need 2+ instances → Redis required.** Two-part task:

1. **Provision:** console.upstash.com → Redis → Create → copy `UPSTASH_REDIS_URL` + token.
2. **Wire (code work, not yet done):**
   - Move `watchStore` ([watchStore.js](backend/admin-service/src/course-content/watchStore.js)) to Redis.
   - Move the email queue to BullMQ.
   - I can do this as a focused task when you're ready — say the word.

> If you stay on **a single admin-service instance**, you can hit ~3-5k DAU
> without Redis. Add it when you horizontally scale.

---

## 7 — Sentry (monitoring) ❌ MISSING — advised, not blocking

Error + performance tracking. Code is ready ([observability.js](backend/admin-service/src/observability.js) in every service) — DSN-guarded (no-op until set).

**Get it:** sentry.io → create project (Node) → **Settings → Client Keys (DSN)** → copy DSN.
**Fill in `credentials.env`:** `SENTRY_DSN`.

> Grafana/uptime: point a monitor at each service's `/health` endpoint (no key needed).

---

## 8 — SMTP (email) ❌ MISSING — optional

Powers batch-add + pre-assessment confirmation emails. App runs fine without it.
Any provider works (Brevo, SendGrid, Gmail SMTP). Fill `SMTP_*` in `credentials.env`.

---

## 9 — Cloudflare CDN / WAF ⏸️ infra-level

No API key in the repo. Set up at deploy time: put the frontend + Bastion behind
Cloudflare (DNS proxy on), enable caching rules on `/api/v1/.../public/*` and static
assets. Covered in [LMS_infrastructure_reference.md §9](LMS_infrastructure_reference.md).

---

## How to use this

```powershell
# 1. Edit values in credentials.env (fill the MISSING ones)
# 2. Distribute to all services:
cd "c:\Users\malli\Desktop\Misson Impossible\YagnaTechOrg"
node sync-credentials.js
# 3. Restart the affected services (.env changes need a restart)
```

`sync-credentials.js` skips blank values, so you can fill keys incrementally —
do Supabase now (done), add R2 + Bunny when ready, Redis when you scale.

---

## Priority order for 5k DAU (no compromise)

1. ✅ **Supabase** (DB + Auth) — done
2. ❌ **Cloudflare R2** — do next (uploads)
3. ❌ **Bunny Stream** — do next (video — the core LMS feature)
4. ❌ **Sentry** — before launch (you'll want error visibility)
5. ⚠️ **Razorpay secret** — when you enable paid courses
6. ❌ **Upstash Redis + BullMQ wiring** — when you scale to 2+ instances
7. ⏸️ **Cloudflare CDN** — at deploy
8. ❌ **SMTP** — whenever you want transactional email
