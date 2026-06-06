# Complete LMS Use-Case Test — "Launch Robotics 101"

One realistic end-to-end run that exercises **marketing content, courses, teachers,
students, demos, timetable, delegation, and the student learning loop** — then deploy.

Follow top to bottom. Each step has **Where → Do → Expect** and a ☐ to tick.

---

## Pre-flight (already running locally)
| Thing | URL |
|---|---|
| Frontend (site + admin) | http://localhost:8080 |
| Bastion gateway | http://localhost:8000 |
| auth-service | http://localhost:8001 |
| admin-service | http://localhost:5000 |

Logins (both verified working):
- **Admin:** `admin@gmail.com` / `admin1234`   ← note: `admin1234`, NOT `admin123`
- **Root admin:** `vrroot@vrroboticsacademy.com` / `VrRoot@2026`
- **Existing teacher (if you want to skip creating one):** `mohan@gmail.com` / `Teacher@123`

> ⚠️ Email (SMTP) is OFF locally → welcome emails won't arrive. So whenever you set a
> password (converting a lead / adding a student/teacher), **write it down** and log in manually.

---

## PART 1 — Admin builds the catalog + marketing site

### 1. Log in as admin
- **Where:** http://localhost:8080 → Login
- **Do:** sign in with the admin creds above
- **Expect:** lands on **Dashboard** (`/admin/dashboard`); sidebar visible
- ☐ pass

### 2. Marketing → Gallery
- **Where:** sidebar **Marketing → Gallery** (`/admin/gallery`)
- **Do:** Add → upload an image, title, save
- **Expect:** item appears in the Gallery list
- ☐ pass

### 3. Marketing → Books / Projects / Testimonials
- **Where:** **Marketing → Books** (`/admin/books`), **Projects** (`/admin/projects`), **Testimonials** (`/admin/testimonials`)
- **Do:** add one entry in each (title + image/fields)
- **Expect:** each saves and lists
- ☐ books ☐ projects ☐ testimonials

### 4. Create a Course + curriculum
- **Where:** **Course → Add New Course** (`/admin/course/create`)
- **Do:** title "Robotics 101", category, price (set 0 for a free course to skip payments), description, save
- **Then:** open it in **Manage Courses** (`/admin/courses`) → add **curriculum**: a few lessons (a **video**, a **PDF**, a **quiz**)
- **Expect:** course shows with lessons; status can be set Published
- ☐ course created ☐ lessons added

### 5. Demos / Classes / Time table / Slots
- **Where:** **Demos** (`/admin/demos`), **Classes** (`/admin/classes`), **Time table** (`/admin/timetable`), **Slots** (`/admin/slots`)
- **Do:** add one entry in each (course + start/end time + teacher/students as the form asks)
- **Expect:** each schedule entry saves and lists
- ☐ demo ☐ class ☐ timetable ☐ slot

---

## PART 2 — Onboard people

### 6. Add a Teacher
- **Where:** **Users → Teacher → Add New Teacher** (`/admin/teachers/create`)
- **Do:** name, email (e.g. `teacher.new@test.com`), **set a password**, expertise, photo, save
- **Expect:** appears in **Manage Teachers** (`/admin/teachers`)
- ☐ pass  → password used: ________

### 7. Student acquisition — the Lead pipeline (the real "student registration")
> Public self-signup is disabled by design — interested people become **Leads**, and the admin converts them.

**7a. Capture a lead (as a visitor)**
- **Where:** public site → **"Register your interest"** form (home / register link)
- **Do:** name + email (e.g. `student.new@test.com`) + phone → Submit
- **Expect:** "Request received" message; **no** login created
- ☐ pass

**7b. Convert the lead (as admin)**
- **Where:** **Leads → Manage Leads** (`/admin/leads`); Dashboard shows a 🔔 "N new leads"
- **Do:** open the lead → add a note / mark **contacted** → **Convert** → **set a password**
- **Expect:** lead flips to `converted`; a real student account is created (Supabase + profile)
- ☐ pass → student password used: ________

> Alternative direct path: **Users → Student → Add New Student** (`/admin/students/create`).

---

## PART 3 — Delegate the course & teach

### 8. Assign the course to the teacher + build the roster
- **Where:** **Teacher Assignments → Add Assignment** (`/admin/teaching?tab=add`)
- **Do:** pick **Robotics 101** + the teacher from step 6 → Assign. Then open it in **Manage Assignments** (`/admin/teaching`) → **Add student** (the converted student) and/or **Add batch**
- **Expect:** assignment created; student in roster. (Adding a student already owned by another teacher *for the same course* → blocked **409**.)
- ☐ assigned ☐ roster added

### 9. Teacher releases today's lessons
- **Where:** log out → log in as the **teacher** (step 6) → **My Classes**
- **Do:** select the assignment → tick 1–2 lessons → **Release selected**
- **Expect:** released lessons marked; **Revoke** removes access
- ☐ pass

---

## PART 4 — Student learns

### 10. Student logs in and uses the player
- **Where:** log out → log in as the **student** (step 7b)
- **Do:** open **Robotics 101** in the course player
- **Expect:**
  - released lessons **play**; un-released show *"your teacher hasn't released this yet"*
  - **locked lesson's video URL is withheld** (DevTools → Network: `lesson_src` empty for locked) ← security gate
- ☐ released plays ☐ locked withheld

### 11. Complete a lesson + quiz + leaderboard
- **Do:** finish a video → mark complete; take the quiz; open **Leaderboard**
- **Expect:** progress updates; quiz score recorded; you appear on the leaderboard (2nd load is faster = Redis cache)
- ☐ progress ☐ quiz ☐ leaderboard

### 12. Verify progress (admin/teacher)
- **Where:** as teacher/admin → the assignment's **Student progress** card
- **Expect:** the student's completed-of-released % reflects step 11
- ☐ pass

---

## PART 5 — Public marketing site reflects content
- **Where:** public site (home / gallery / books / projects pages)
- **Expect:** the Gallery image, Books, Projects, Testimonials from Part 1 are visible to visitors
- ☐ pass

---

## PART 6 — Security spot-checks (fast, important)
- ☐ Calling an admin route with **no token** → **401**
- ☐ A student/teacher **cannot** become admin by editing their own `user_metadata.role` (verified: forged-root token → **403**)
- ☐ Logged-out player request for a **locked** lesson returns empty `lesson_src` (no `user_id` spoofing)

*(These are already automated-verified in this environment; re-check #1 and #3 by hand if you like.)*

---

## What you CANNOT fully test locally (config-gated — do in staging)
- **Payments** — Razorpay keys unset → "Buy" returns **503**. Use a free course (price 0) for this run; test paid flow in staging with **test** keys.
- **Signed video playback** — `BUNNY_STREAM_TOKEN_KEY` unset → videos play but URLs are unsigned/shareable.
- **Email** — SMTP unset → welcome/lead-convert emails don't send (set passwords manually).

---

## PART 7 — Deploy (after the run above is green)

1. **Set production env** (per `GO_LIVE_CHECKLIST.md`), especially:
   - `NODE_ENV=production`, strong `JWT_SECRET`, `SUPABASE_JWT_SECRET`
   - `CORS_ORIGINS` (auth) and `ADMIN_ALLOWED_ORIGINS` (admin) = your deployed frontend
   - `DATABASE_URL` on the **:6543** transaction pooler
   - `RAZORPAY_*` (test first), `BUNNY_STREAM_TOKEN_KEY`, `SMTP_*`
2. **Push the branch** (`security/pre-deploy-hardening`) and open a PR.
3. **Deploy the 4 services** on Railway: admin (public), auth (private), Bastion (public), frontend.
4. **Restart admin-service once** so new tables auto-create; confirm `[cache] Redis connected` and a clean boot log.
5. **Re-run PART 1–6 against the deployed URLs** (smoke), then enable Razorpay live keys + Bunny token auth.

> Reminder: code is verified (22 unit + 8/8 integration incl. the privilege-escalation block). The
> remaining risk is **config/ops**, not code — work the checklist.
