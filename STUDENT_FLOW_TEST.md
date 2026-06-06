# Student Flow — Step-by-Step Test Guide

Follow these in order in the running app. Every step has an **Action** and a
**✅ Verify**. This whole chain was just proven live end-to-end (8/8, incl. real
Supabase login) — this guide lets you reproduce it in the UI.

> Tip: use **two browsers** (or one normal + one incognito) — one logged in as
> admin/teacher, one as the student — so you don't keep logging out.

---

## 0. Start everything
**Action:** in `YagnaTechOrg/`, run `powershell -ExecutionPolicy Bypass -File .\restart.ps1`
**✅ Verify:** each service window opens; admin-service log shows `admin-service running on 5000` and `[cache] Redis connected`. Open the frontend URL the script prints.

## 1. Admin logs in
**Action:** open the app → log in as root admin (`vrroot@vrroboticsacademy.com / VrRoot@2026`).
**✅ Verify:** you land in the admin panel with the full sidebar.

## 2. Admin creates a student (with login)
**Action:** Sidebar → **Users → Student → Add New Student**. Fill **Name, Email, Password** (≥8 chars) → Save.
**✅ Verify:** the student appears in **Manage Students**. (This created a real login — Supabase + profile.)
*(Alternative path: public Register form → admin **Leads** → **Convert** → welcome email with the password.)*

## 3. Student logs in (second browser)
**Action:** in an incognito window, open the app → log in with the **student's email + password** from step 2.
**✅ Verify:** you land on the **student dashboard** (`/dashboard`). "My Courses" is empty for now — that's correct (no course assigned yet).

## 4. Admin assigns a course to a teacher + adds the student
**Action (admin browser):** Sidebar → **Teacher Assignments** → pick a **Course** + **Teacher** → Assign. Select the assignment → **Add student** → choose the student from step 2.
**✅ Verify:** the student shows under "Roster (N students)".
*(Prereq: a course with lessons and at least one teacher must exist. Create them under Course / Users → Teacher if needed.)*

## 5. Teacher releases a lesson
**Action:** log in as that **teacher** → Sidebar → **My Classes** → select the assignment → tick **one or two lessons** → **Release selected**.
**✅ Verify:** the lessons show "● released".

## 6. Student sees the course & learns
**Action (student browser):** refresh the **dashboard → My Courses** tab.
**✅ Verify:**
- The course now appears as a card with a progress bar.
- Open it → the **released** lesson plays.
- An **un-released** lesson shows *"Your teacher hasn't released this lesson yet"* and the video does **not** load (check Network tab: `lesson_src` is empty). ← this is the access control working.

## 7. Progress + leaderboard
**Action:** in a released lesson, watch ~20s or click **Mark as complete**. Then open the dashboard **Leaderboard** tab.
**✅ Verify:** the lesson shows completed; the **Leaderboard** lists the student with points (completion ×10 + quiz ×5), "You" highlighted. Admin/teacher can see the same under the assignment's **Student progress**.

## 8. (Optional) Paid-course path — needs Razorpay keys
Once `RAZORPAY_KEY_*` are set in `.env` + the webhook is configured:
**Action (student):** open a **paid** course in the catalog → **Buy this course** → pay (Razorpay test card).
**✅ Verify:** redirected into the player; the course appears in **My Courses** immediately; the detail page now says **"✓ You own this course / Go to Course"**.

---

## What this proves (the complete student lifecycle)
create student → **real login** → assigned a course → teacher drips lessons →
student sees only released content (rest locked server-side) → progress tracked →
ranked on the leaderboard → (with keys) can buy courses.

If any step fails, check: services up (`/api/health`), the student's token is sent
(DevTools → Local Storage has `accessToken` + `userId`), and the course actually
has lessons. See `END_TO_END_TESTING.md` for API-level checks.
