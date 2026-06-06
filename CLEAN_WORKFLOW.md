# VR Robotics LMS — THE Clean Workflow (single source of truth)

Brutally honest map of how the LMS *actually* works today. This is the
**canonical path** — build on this, ignore the legacy duplicates listed at the
bottom. Nothing here changes behaviour; it documents the real flow so the team
stops tripping over the duplication.

---

## Canonical stack (what's actually in the path)

| Layer | Use THIS | Ignore (legacy / out of path) |
|---|---|---|
| Identity | **auth-service** (JWT) | — |
| Everything LMS (courses, lessons, catalog, player, payments, leads, delegation, progress) | **admin-service** + **`lms_admin`** schema | course-service, organization-service, `lucy_devdb.courses`, `lucy_devdb.enrollments` |
| Gateway | **Bastion** (`:8000`) | — |
| Frontend | **`frontend/src/admin`** (admin shell) + `frontend/src/pages` (student/public) | `frontend/src/LMS-admin`, `YagnaTech-admin.zip` |
| Payments | **admin-service** Razorpay (`/api/public/payments/*`) | the empty `payment-service` (branch/college only) |
| Course list / "My Courses" | **`/api/public/my-courses`** (paid ∪ enrolled ∪ delegated) | course-service `/enroll/my-courses` |

**Rule of thumb:** if it's about a student learning, it lives in **admin-service / lms_admin**. Full stop.

---

## 1. Roles & who does what
- **Root admin** — creates courses + lessons, teachers, students, marketing content; assigns courses to teachers; works leads. Does NOT manage thousands of students directly.
- **Teacher** — owns assigned courses + their roster (batch/individual); releases lessons day by day; sees student progress.
- **Student** — buys or is granted a course; sees only released lessons; learns; progress tracked.

---

## 2. Student onboarding (interested → learning)
```
Public Register form → LEAD (no login)  →  "Request received"
   → Admin → Leads (🔔 dashboard alert) → follow up → Convert (set password)
   → 📧 welcome email with login → student signs in
```
Endpoints: `POST /api/public/leads` → admin `…/leads` → convert (reuses StudentService.create) → email.

## 3. Buying a course (B2C revenue)
```
Catalog (/courses) → Course detail → "Buy this course"
   → /payments/order → Razorpay → /payments/verify (+ webhook) → access granted
   → course detail shows "✓ You own this course / Go to Course"
   → appears in Dashboard → My Courses grid
```
Paywall: paid course locks all non-free lessons until `hasPaid` (skipped for delegated courses).

## 4. Teacher delegation (B2B school/batch)
```
Admin → Teacher Assignments: course → teacher + roster (batch and/or individuals)
   → Teacher → My Classes: release today's lessons (video/PDF/quiz)
   → Student: only released lessons unlock; video URL withheld for locked
   → Teacher/Admin: Student Progress (completed-of-released %)
```

## 5. Learning + progress
```
Dashboard → My Courses grid (paid ∪ enrolled ∪ delegated, with progress)
   → Player: serves only accessible lessons; marks complete/progress (verified id)
   → progress is DB-backed (correct across servers)
```

## 6. Access rules (server-enforced)
- Student identity = **verified JWT**, never the `x-user-id` header (no spoofing).
- Teacher sees only their own assignments/students; college admin only their college; root sees all.
- Locked/un-released/unpaid lessons never return a video URL.

---

## What's CLEAN ✅ vs what's MESSY ⚠️ (no sugar-coating)

**Clean & verified:** onboarding→lead→convert, delegation+release+gating, payments+paywall+Buy, My Courses (canonical), progress, anti-fraud/privacy, the varchar-id bug class, CI.

**Messy (structural debt — does NOT change user workflow, but should be retired):**
- ⚠️ **Two course tables / two DBs.** Canonical = `lms_admin`. `lucy_devdb.courses` + course-service are legacy for the student path. *Recommendation: freeze course-service for student flows; migrate any remaining readers to `lms_admin`.*
- ⚠️ **Enrollment write still split** across `user_progress` (program) + `payments` (purchase) + delegation rosters. Reads are unified in `/my-courses`. *Recommendation: treat `/my-courses` as the one read API everywhere; don't add new enrollment stores.*
- ⚠️ **6 microservices** for one team. Only **auth + admin** are on the hot path. *Recommendation: don't add services; consider folding course/organization-service into admin-service later.*
- ⚠️ **Dead frontends/clients**: `frontend/src/LMS-admin`, `YagnaTech-admin.zip`, course-service `courseApi.tsx` my-courses call (now bypassed). *Recommendation: delete in a dedicated cleanup PR (not mixed with features).*

**Config to go live (your side):** `RAZORPAY_*`, `BUNNY_STREAM_TOKEN_KEY` in `.env`; commit/push to activate CI.

---

## The one principle that keeps it clean
**All student-facing reads/writes go through `admin-service` against `lms_admin`, keyed by the verified auth userId (string).** Anything that reaches into `lucy_devdb` course/enrollment tables for the student flow is, by definition, off the canonical path.
