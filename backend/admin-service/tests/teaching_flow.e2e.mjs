/**
 * End-to-end API test for the teacher-delegation flow. Hits the REAL running
 * admin-service over HTTP (no Selenium, uses native fetch). It exercises the
 * full path: admin assigns → admin adds roster → teacher releases → student
 * sees released lesson AND is blocked from an un-released video.
 *
 * Run (PowerShell), with a running stack:
 *   $env:ADMIN_TOKEN="<admin JWT>"
 *   $env:TEACHER_TOKEN="<teacher JWT>"      # optional — falls back to ADMIN_TOKEN
 *   $env:COURSE_ID="12"
 *   $env:COURSE_SLUG="intro-to-robotics"
 *   $env:TEACHER_ID="10000000001"           # auth users.userId of a teacher
 *   $env:STUDENT_ID="10000000055"           # a student to add individually
 *   $env:RELEASE_LESSON_ID="101"            # a lesson to release
 *   $env:LOCKED_LESSON_ID="102"             # a DIFFERENT lesson to stay locked
 *   node tests/teaching_flow.e2e.mjs
 *
 * Get tokens from the browser after logging in: DevTools → Application →
 * Local Storage → `admin_token` (admin) / `accessToken` (teacher).
 *
 * Missing env → the script prints what's needed and exits 0 (skipped, not failed).
 */
const BASE = process.env.ADMIN_BASE || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TEACHER_TOKEN = process.env.TEACHER_TOKEN || ADMIN_TOKEN;
const COURSE_ID = process.env.COURSE_ID;
const COURSE_SLUG = process.env.COURSE_SLUG;
const TEACHER_ID = process.env.TEACHER_ID;
const STUDENT_ID = process.env.STUDENT_ID;
const RELEASE_LESSON_ID = Number(process.env.RELEASE_LESSON_ID);
const LOCKED_LESSON_ID = Number(process.env.LOCKED_LESSON_ID);

const required = { ADMIN_TOKEN, COURSE_ID, COURSE_SLUG, TEACHER_ID, STUDENT_ID, RELEASE_LESSON_ID, LOCKED_LESSON_ID };
const missing = Object.entries(required).filter(([, v]) => !v || (typeof v === 'number' && Number.isNaN(v))).map(([k]) => k);
if (missing.length) {
    console.log('⏭  SKIP teaching e2e — set these env vars first:', missing.join(', '));
    process.exit(0);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
    if (cond) { console.log(`  ✅ ${name}`); pass++; }
    else { console.error(`  ❌ ${name} ${extra}`); fail++; }
};

const req = async (method, path, { token, body } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data };
};

(async () => {
    console.log(`\n=== Teacher-delegation e2e against ${BASE} ===`);
    let assignmentId = null;
    try {
        // 1. Admin assigns the course to the teacher.
        const a = await req('POST', '/api/admin/teaching-assignments', {
            token: ADMIN_TOKEN, body: { course_id: COURSE_ID, teacher_id: TEACHER_ID },
        });
        ok('admin can assign course→teacher', a.status === 200 && a.data?.assignment?.id, JSON.stringify(a.data));
        assignmentId = a.data?.assignment?.id;
        if (!assignmentId) throw new Error('no assignment id — aborting');

        // 2. Admin adds an individual student to the roster.
        const m = await req('POST', `/api/admin/teaching-assignments/${assignmentId}/members`, {
            token: ADMIN_TOKEN, body: { studentIds: [STUDENT_ID] },
        });
        ok('admin can add a student to the roster', m.status === 200, JSON.stringify(m.data));

        // 3. Roster resolves the student.
        const r = await req('GET', `/api/admin/teaching-assignments/${assignmentId}/roster`, { token: ADMIN_TOKEN });
        const inRoster = (r.data?.students || []).some((s) => String(s.id) === String(STUDENT_ID));
        ok('roster includes the added student', r.status === 200 && inRoster, JSON.stringify(r.data?.students));

        // 4. Student sees NOTHING released yet (delegated, but no releases).
        const before = await req('GET', `/api/public/my-lessons?course_id=${COURSE_ID}&user_id=${STUDENT_ID}`, {});
        ok('before release: course is delegated', before.data?.delegated === true, JSON.stringify(before.data));
        ok('before release: student sees no lessons', (before.data?.lesson_ids || []).length === 0, JSON.stringify(before.data));

        // 5. Teacher releases ONE lesson.
        const rel = await req('POST', `/api/admin/teaching-assignments/${assignmentId}/releases`, {
            token: TEACHER_TOKEN, body: { lessonIds: [RELEASE_LESSON_ID] },
        });
        ok('teacher can release a lesson', rel.status === 200, JSON.stringify(rel.data));

        // 6. Student now sees exactly the released lesson.
        const after = await req('GET', `/api/public/my-lessons?course_id=${COURSE_ID}&user_id=${STUDENT_ID}`, {});
        const visible = after.data?.lesson_ids || [];
        ok('after release: released lesson is visible', visible.includes(RELEASE_LESSON_ID), JSON.stringify(visible));
        ok('after release: locked lesson is NOT visible', !visible.includes(LOCKED_LESSON_ID), JSON.stringify(visible));

        // 7. SECURITY: the player must NOT serve the locked lesson's video URL.
        const player = await req('GET',
            `/api/public/player/${COURSE_SLUG}?lesson_id=${LOCKED_LESSON_ID}&user_id=${STUDENT_ID}`, {});
        const lessonSrc = player.data?.lesson?.lesson_src;
        ok('player marks course delegated', player.data?.delegated === true, JSON.stringify(player.data?.delegated));
        ok('SECURITY: locked lesson video src is withheld', !lessonSrc, `got src="${lessonSrc}"`);
        ok('player lists the locked lesson as locked',
            (player.data?.locked_lesson_ids || []).includes(LOCKED_LESSON_ID),
            JSON.stringify(player.data?.locked_lesson_ids));

        // 8. The released lesson DOES play.
        const okPlayer = await req('GET',
            `/api/public/player/${COURSE_SLUG}?lesson_id=${RELEASE_LESSON_ID}&user_id=${STUDENT_ID}`, {});
        ok('released lesson is not in locked list',
            !(okPlayer.data?.locked_lesson_ids || []).includes(RELEASE_LESSON_ID),
            JSON.stringify(okPlayer.data?.locked_lesson_ids));
    } catch (e) {
        console.error('  ❌ unexpected error:', e.message);
        fail++;
    } finally {
        // Cleanup — remove the assignment we created (cascades roster + releases).
        if (assignmentId) {
            const d = await req('DELETE', `/api/admin/teaching-assignments/${assignmentId}`, { token: ADMIN_TOKEN });
            ok('cleanup: assignment removed', d.status === 200, JSON.stringify(d.data));
        }
    }

    console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
    process.exit(fail ? 1 : 0);
})();
