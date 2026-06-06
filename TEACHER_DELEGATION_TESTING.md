# Teacher Delegation — How to Test

Covers the flow: **admin assigns a course + roster to a teacher → teacher releases lessons day by day → students see only released lessons, and locked videos are withheld by the server.**

There are three layers of testing, from fastest to most realistic.

---

## 1. Unit tests (no DB, no running services) — run anytime

Tests the security-critical decision logic (release visibility, the one-teacher-per-student rule, and the video-gating decision).

```powershell
cd "c:\Users\malli\Desktop\Misson Impossible\YagnaTechOrg\backend\admin-service"
npm test
```

Expected: **13 passing** (`pass 13  fail 0`). No setup needed — pure functions in `src/services/teachingLogic.js`.

---

## 2. API integration test (running stack, no browser)

Drives the real HTTP endpoints end to end and asserts the **security guarantee** (an un-released video's URL is not served).

**Get two tokens** from the browser after logging in (DevTools → Application → Local Storage):
- `admin_token` → an admin's JWT
- `accessToken` → a teacher's JWT

**Pick test data that already exists in your DB:** a course id + slug, a teacher userId, a student userId, and two lesson ids of that course.

```powershell
cd "c:\Users\malli\Desktop\Misson Impossible\YagnaTechOrg\backend\admin-service"
$env:ADMIN_TOKEN="<admin JWT>"
$env:TEACHER_TOKEN="<teacher JWT>"
$env:COURSE_ID="12"
$env:COURSE_SLUG="intro-to-robotics"
$env:TEACHER_ID="10000000001"
$env:STUDENT_ID="10000000055"
$env:RELEASE_LESSON_ID="101"
$env:LOCKED_LESSON_ID="102"
npm run test:teaching-e2e
```

It asserts: assign → add student → roster resolves → before-release student sees nothing → teacher releases → student sees the released lesson only → **locked lesson's `lesson_src` is empty** → cleanup. Missing env → it skips (exit 0), never false-fails.

---

## 3. Manual UI walkthrough (the real thing)

Start the stack (`./restart.ps1`), then:

| # | As | Do | Expect |
|---|----|----|--------|
| 1 | **Admin** (`vrroot@…`) | Sidebar → **Teacher Assignments** → pick a course + teacher → **Assign** | New assignment appears in the list |
| 2 | Admin | Select it → **Add batch** and/or **Add student** | Students appear under "Roster (N students)" |
| 3 | Admin | Try adding a student already assigned to another teacher **for the same course** | Blocked with a 409 toast (one-teacher rule) |
| 4 | **Teacher** (that teacher's login) | Sidebar → **My Classes** → select assignment → tick 2–3 lessons → **Release selected** | "Released N lesson(s)"; they show "● released" |
| 5 | **Student** (in that batch/roster) | Open the course player | Only released lessons are unlocked |
| 6 | Student | Open an **un-released** lesson | Lock screen: *"Your teacher hasn't released this lesson yet."* — video does **not** play |
| 7 | Teacher | **Revoke** a released lesson | Student loses access on next load |
| 8 | Admin | A course with **no** assignment | Behaves exactly as before (no gating) — nothing broke |

---

## 4. Quick manual API checks (PowerShell)

```powershell
$BASE="http://localhost:5000"
$H=@{ Authorization = "Bearer <admin JWT>" }

# Create assignment
Invoke-RestMethod -Method Post -Uri "$BASE/api/admin/teaching-assignments" -Headers $H `
  -ContentType "application/json" -Body '{"course_id":12,"teacher_id":"10000000001"}'

# Add a student (use the id from above as :id)
Invoke-RestMethod -Method Post -Uri "$BASE/api/admin/teaching-assignments/1/members" -Headers $H `
  -ContentType "application/json" -Body '{"studentIds":["10000000055"]}'

# Teacher releases a lesson (teacher token)
$T=@{ Authorization = "Bearer <teacher JWT>" }
Invoke-RestMethod -Method Post -Uri "$BASE/api/admin/teaching-assignments/1/releases" -Headers $T `
  -ContentType "application/json" -Body '{"lessonIds":[101]}'

# Student daily card (public)
Invoke-RestMethod -Uri "$BASE/api/public/my-lessons?course_id=12&user_id=10000000055"

# SECURITY: a locked lesson must come back with empty lesson_src
(Invoke-RestMethod -Uri "$BASE/api/public/player/intro-to-robotics?lesson_id=102&user_id=10000000055").lesson.lesson_src
# → should be empty
```

---

## Acceptance criteria (what "working" means)

- [ ] Admin can assign a course to a teacher and build a roster (batch + individuals).
- [ ] A student cannot be assigned to two teachers for the same course (409).
- [ ] Teacher sees **only** their own assignments; releasing reaches the whole roster in one action.
- [ ] Student sees a lesson **only** after it's released; revoke removes access.
- [ ] **An un-released lesson's video URL is never returned by the API** (the core security guarantee).
- [ ] Courses with no teaching assignment are unaffected (legacy behaviour preserved).
