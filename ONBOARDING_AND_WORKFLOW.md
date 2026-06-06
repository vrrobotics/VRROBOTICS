# VR Robotics LMS — Onboarding & Workflow (the whole picture)

A plain-English map of how a person goes from "interested" to "learning", and
how teachers and admins drive it. Everything below is **functional** (no
hardcoded/demo data) unless explicitly marked *Not built yet*.

---

## 1. Student onboarding — interested → learning

```
  Public website (Register form)
        │  name / email / phone / interest
        ▼
  LEAD created  (status: new)        ← no login yet, by design
        │                              "Request received" shown to the person
        ▼
  Admin → Leads               🔔 dashboard shows "N new leads"
        │  follow up: notes, mark "contacted"
        ▼
  Admin clicks CONVERT, sets a password
        │  → real student account created (Supabase + profile)
        │  → 📧 welcome email sent with email + password + Sign-in button
        ▼
  Student signs in
        │
        ▼
  Sees ONLY what their teacher releases (see flow 2)
```
Key files: `RegisterForm.tsx` → `POST /api/public/leads` → `LeadService` →
`admin/pages/leads` (Convert) → `studentWelcome` email.

---

## 2. Teacher workflow — daily teaching

```
  ADMIN (one-time setup)
    • Teacher Assignments → assign a COURSE to a TEACHER
    • Add the roster: a whole BATCH and/or individual students
      (one student can belong to only ONE teacher per course)
        │
        ▼
  TEACHER (every class)         sidebar → "My Classes"
    • picks today's 2–3 lessons (video / PDF / quiz) → "Release selected"
    • can Revoke access anytime
        │
        ▼
  STUDENT
    • released lessons unlock in the player
    • un-released lessons stay locked AND the video URL is withheld server-side
        │
        ▼
  TEACHER + ADMIN
    • "Student progress" card: each student's completed-of-released %, live
```
Key files: `teaching/Index.jsx` (assign / roster / release / progress) →
`TeachingAssignmentService` → player gating in `PublicCourseService.playerData`.

---

## 3. Admin workflow — what the admin actually does

```
  • Create courses + curriculum (lessons: video/PDF/quiz)
  • Marketing content (Books / Projects / Gallery / Testimonials) for the site
  • Manage Schools / Batches / Teachers / Students
  • Work the Leads pipeline (convert interested people to students)
  • Delegate courses to teachers (Teacher Assignments) — then teachers run day-to-day
```
The admin does NOT manage thousands of students directly — they delegate to
teachers, who manage their own rosters. That's the core scaling idea.

---

## 4. Who can see what (access rules, enforced server-side)
- **Teacher** sees only their own assignments + their own students.
- **Student** sees only lessons released to them; the video URL is not served
  for locked lessons; identity is taken from a verified token, not a header
  (no spoofing another student).
- **College admin** sees only their own college's data.
- **Root admin** sees everything.

---

## 5. Not built yet (be honest with whoever maintains this)
- **Payments / paywall** — `payment-service` has no gateway yet. Chosen: Razorpay.
  Until built, paid courses aren't actually gated by payment.
- **Mentor earnings/payout dashboard** (`MentorPanel`) — shows a "coming soon"
  placeholder; needs an earnings backend.
- **CI** — tests run manually (`npm test`), not automatically on push.
- **Bunny video URL signing** — inert until `BUNNY_STREAM_TOKEN_KEY` is set.

---

## 6. Config (nothing hardcoded — set these in `backend/admin-service/.env`)
| Key | Purpose |
|-----|---------|
| `JWT_SECRET` | sign/verify admin tokens (boot fails in prod if weak) |
| `SUPABASE_JWT_SECRET` / Supabase URL | verify student/teacher tokens |
| `DATABASE_URL` | Postgres (lms_admin) |
| `BUNNY_STREAM_*` (+ `BUNNY_STREAM_TOKEN_KEY`) | video upload + signed playback |
| `SMTP_*` / `LMS_LOGIN_URL` | transactional email (welcome, batch, certs) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | payments (once built) |

See `END_TO_END_TESTING.md` for how to test each flow.
