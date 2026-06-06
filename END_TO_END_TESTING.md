# VR Robotics LMS — End-to-End Testing Runbook

Practical guide to test the whole flow and a maintainer reference for the
non-obvious things that will bite you. Covers: **teacher delegation, lesson
release/gating, leads pipeline, student progress, and the security hardening.**

---

## 0. Run the stack

```powershell
cd "c:\Users\malli\Desktop\Misson Impossible\YagnaTechOrg"
.\restart.ps1          # stop + relaunch all services (fast)
# first time ever: .\run.ps1   (installs, migrates, seeds, launches)
```
Each service opens its own window. Ports: auth 8001, **admin 5000**, assessment 8003, gateway 8000, frontend 5173/8080 (the script prints the URL).

New tables (`teaching_assignments`, `assignment_members`, `lesson_releases`,
`leads`) are auto-created on **admin-service boot** via `Model.sync()` — restart
admin-service once after pulling changes.

Logins (from run.ps1): root admin `vrroot@vrroboticsacademy.com / VrRoot@2026`.

---

## 1. Automated tests (fastest confidence)

```powershell
cd backend\admin-service
npm test                 # 13 unit tests — pure gating/roster/release logic, no DB
```

The deeper HTTP/DB checks were run during development as throwaway harnesses
(spoof-blocked, release gating, leads pipeline, progress write→read). To re-run
the API integration test against a live stack, set tokens + ids and:
```powershell
npm run test:teaching-e2e
```
(See `tests/teaching_flow.e2e.mjs` header for the env vars; it skips if unset.)

**How to get a token for manual API calls:** log in, then DevTools → Application
→ Local Storage → copy `admin_token` (admin) or `accessToken` (student/teacher).

---

## 2. Manual UI walkthrough (the real end-to-end)

### A. Lead → student (signup pipeline)
1. Open the public **Register** page → fill name/email/mobile → Submit → you see
   **"Request received"** (NO login is created — by design).
2. Admin → sidebar **Leads** → the signup appears as `new`. The **Dashboard**
   shows a 🔔 "N new leads" alert.
3. Add follow-up notes, mark **contacted**, then **Convert** → set a password →
   a real student account is created (lead → `converted`).

### B. Admin delegates a course to a teacher
4. Admin → **Teacher Assignments** → pick a course + teacher → Assign.
5. Select it → **Add batch** and/or **Add student** (the converted student).
   Adding a student already owned by another teacher *for the same course* is
   blocked (409).

### C. Teacher releases daily lessons
6. Log in as that **teacher** → **My Classes** → select the assignment → tick
   2–3 lessons → **Release selected**. Revoke removes access.

### D. Student sees only released content
7. Log in as the **student** → open the course player.
   - Released lessons play; un-released lessons show
     *"Your teacher hasn't released this lesson yet"* and the **video URL is not
     served** (verify in Network tab: `lesson.lesson_src` is empty for locked).
8. Complete a lesson → admin/teacher see it under **Student progress** on the
   assignment (completion bar, %).

### E. Security spot-check (important)
9. While logged out, hit `/api/public/player/<slug>?lesson_id=<locked>&user_id=<student>`
   with **no token** → the locked lesson's `lesson_src` must be **empty**
   (spoofing another student via `user_id` is blocked).

---

## 3. Quick API checks (PowerShell)

```powershell
$BASE="http://localhost:5000"; $H=@{ Authorization = "Bearer <admin JWT>" }
# Public lead capture (no auth)
Invoke-RestMethod -Method Post -Uri "$BASE/api/public/leads" -ContentType application/json -Body '{"name":"Test","email":"t@x.com"}'
# Admin: leads + stats
Invoke-RestMethod -Uri "$BASE/api/admin/leads" -Headers $H
Invoke-RestMethod -Uri "$BASE/api/admin/leads/stats" -Headers $H
# Assignment progress
Invoke-RestMethod -Uri "$BASE/api/admin/teaching-assignments/<id>/progress" -Headers $H
# SECURITY: a locked lesson must return empty lesson_src
(Invoke-RestMethod -Uri "$BASE/api/public/player/<slug>?lesson_id=<locked>&user_id=<student>").lesson.lesson_src
```

---

## 4. ⚠️ Maintainer gotchas (things that WILL break if you don't know them)

1. **Route order on `/api/admin`.** `adminOnly` mounts run for *every*
   `/api/admin/*` request and short-circuit non-admins with 403. Any
   `adminOnly` router MUST be registered **after** the `adminOrTeacher` routers
   (course, curriculum, teaching) in `server.js`, or you'll 403 teachers on
   routes they should reach. (This already bit the leads + teaching routes once.)

2. **`user_id` columns are VARCHAR in the live DB** (`lesson_completions`,
   `user_progress`, `lesson_watch_progress`, `batch_members`, etc.) even where a
   model once said BIGINT. **Always query/write `user_id` as a string.** A
   numeric value triggers `operator does not exist: character varying = bigint`
   and — because progress writes are fire-and-forget — fails *silently*.

3. **JWT secret.** `JWT_SECRET` must be long + random in `.env`; the service
   refuses to boot in production with the default/short secret (guard in
   `config/env.js`). `.env` is gitignored — never commit it.

4. **Video URL signing is OFF until you set `BUNNY_STREAM_TOKEN_KEY`.** Until
   then released video URLs are shareable and survive revoke. Set the key
   (Bunny dashboard → pull zone → Security → URL Token Authentication) and the
   player auto-signs playback URLs with a 6h expiry.

5. **Identity on `/api/public/*`** comes from the `x-user-id` header (spoofable).
   Release-gating and `my-lessons` were hardened to trust only a **verified JWT**
   (`optionalAuth`). If you add a new gated public endpoint, gate it on
   `req.authUser`, not the header. The frontend course client now sends the
   `Authorization` token — keep it.

6. **New tables created via `Model.sync()` on boot**, not migrations. Re-running
   `sync()` on an existing table can error on duplicate indexes — that warning at
   boot is harmless; don't "fix" it by dropping indexes.

---

## 5. What's tested vs. not
- ✅ Unit: gating decision, roster conflict, release visibility (13 tests).
- ✅ Verified live (dev): spoof-blocked, release→student-visible, locked-video
  withheld, leads capture→list→convert-guard, progress write→read.
- ✅ CI: `.github/workflows/ci.yml` runs the unit tests + frontend build on
  every push / PR to the YagnaTechOrg repo. (Activates once committed + pushed.)
- ⚠️ Convert-to-student and live payments create real Supabase/Razorpay records —
  exercise those in a staging/test project, not prod.
