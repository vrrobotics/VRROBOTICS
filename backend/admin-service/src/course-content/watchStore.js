// Watch progress store. Writes (completion ticks, watched seconds, resume
// point) are persisted to Postgres on every change (fire-and-forget).
//
// READS are DB-authoritative: use getHistoryDb() / completedCountsByCourse()
// which query per-user. These are what the player, course-progress,
// overview-stats and teacher-progress endpoints call.
//
// The in-memory arrays below are now ONLY a best-effort cache for the mock
// fallback path. We deliberately DO NOT call loadFromDb() at boot any more —
// loading the whole progress table into every process doesn't scale and is
// wrong across multiple instances. loadFromDb()/listHistoriesForUser() are kept
// for that fallback / ad-hoc use but are not on the hot path.

const histories = []; // { course_id, student_id, watching_lesson_id, completed_lesson:[] }
const durations = []; // { course_id, lesson_id, student_id, current_duration, watched_counter:[] }

// Bound the in-memory caches so a long-running instance can't grow without
// limit (reads are DB-authoritative now — these arrays are only a degraded
// fallback + the immediate write response). Over the cap we evict the oldest
// entries. Prevents the slow memory climb under sustained load at scale.
const MAX_CACHE = 5000;
const capArray = (arr) => { if (arr.length > MAX_CACHE) arr.splice(0, arr.length - MAX_CACHE); };

let modelsLazy;
const models = () => {
    if (!modelsLazy) modelsLazy = require('../models');
    return modelsLazy;
};

// Persist a write without blocking the request path. The cache is the source of
// truth for the in-flight response; the DB catches up asynchronously.
// Pending writes are tracked so tests / shutdown hooks can await flush().
const pending = new Set();
const persist = (fn) => {
    const p = Promise.resolve()
        .then(fn)
        .catch((err) => console.warn('[watchStore] persist failed:', err.message))
        .finally(() => pending.delete(p));
    pending.add(p);
};

// Wait for all currently-queued writes to finish. Useful from scripts / tests.
const flush = () => Promise.all(Array.from(pending));

const getHistory = (courseId, userId) => {
    courseId = Number(courseId);
    userId = Number(userId);
    return histories.find((h) => h.course_id === courseId && h.student_id === userId) || null;
};

// DB-authoritative read for ONE (course, user). Unlike getHistory (in-memory,
// single-node, populated only by loadFromDb at boot), this queries the tables
// directly so progress is correct across multiple server instances and after a
// restart without loading every user's rows into memory. Returns the same shape
// getHistory does. Callers should fall back to getHistory on error.
const getHistoryDb = async (courseId, userId) => {
    courseId = Number(courseId);
    // user_id columns are varchar in the DB — query as a string so the match
    // actually works (a numeric value triggers "varchar = bigint" and fails).
    const uid = String(userId == null ? '' : userId).trim();
    if (!courseId || !uid) return null;
    const { LessonCompletion, UserProgress } = models();
    const [completions, prog] = await Promise.all([
        LessonCompletion.findAll({
            where: { user_id: uid, course_id: courseId },
            attributes: ['lesson_id'],
            raw: true,
        }),
        UserProgress.findOne({
            where: { user_id: uid, course_id: courseId },
            attributes: ['last_lesson_id'],
            raw: true,
        }),
    ]);
    return {
        course_id: courseId,
        student_id: userId,
        watching_lesson_id: prog?.last_lesson_id ? Number(prog.last_lesson_id) : null,
        completed_lesson: completions.map((c) => Number(c.lesson_id)),
    };
};

const listHistoriesForUser = (userId) => {
    userId = Number(userId);
    return histories.filter((h) => h.student_id === userId);
};

const ensureHistory = (courseId, lessonId, userId) => {
    courseId = Number(courseId);
    userId = Number(userId);
    let h = histories.find((x) => x.course_id === courseId && x.student_id === userId);
    if (!h) {
        h = { course_id: courseId, student_id: userId, watching_lesson_id: Number(lessonId) || null, completed_lesson: [] };
        histories.push(h);
        capArray(histories);
    }
    return h;
};

const setWatchingLesson = (courseId, lessonId, userId) => {
    const h = ensureHistory(courseId, lessonId, userId);
    h.watching_lesson_id = Number(lessonId);
    persist(async () => {
        const { UserProgress } = models();
        // Best-effort: only updates an existing user_progress row (created at
        // /select-program). Avoids creating orphan enrollment rows here.
        await UserProgress.update(
            { last_lesson_id: Number(lessonId) },
            { where: { user_id: String(userId), course_id: Number(courseId) } },
        );
    });
    return h;
};

const markLessonComplete = (courseId, lessonId, userId) => {
    const h = ensureHistory(courseId, lessonId, userId);
    const lid = Number(lessonId);
    if (!h.completed_lesson.includes(lid)) h.completed_lesson.push(lid);
    h.watching_lesson_id = lid;
    persist(async () => {
        const { LessonCompletion } = models();
        await LessonCompletion.findOrCreate({
            where: { user_id: String(userId), lesson_id: lid },
            defaults: { user_id: String(userId), course_id: Number(courseId), lesson_id: lid },
        });
    });
    return h;
};

const getDuration = (courseId, lessonId, userId) => {
    courseId = Number(courseId);
    lessonId = Number(lessonId);
    userId = Number(userId);
    return durations.find(
        (d) => d.course_id === courseId && d.lesson_id === lessonId && d.student_id === userId,
    ) || null;
};

const upsertDuration = (courseId, lessonId, userId, seconds) => {
    courseId = Number(courseId);
    lessonId = Number(lessonId);
    userId = Number(userId);
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    let d = durations.find(
        (x) => x.course_id === courseId && x.lesson_id === lessonId && x.student_id === userId,
    );
    if (!d) {
        d = { course_id: courseId, lesson_id: lessonId, student_id: userId, current_duration: 0, watched_counter: [] };
        durations.push(d);
        capArray(durations);
    }
    const next = Math.max(d.current_duration, seconds);
    const grew = next > d.current_duration;
    d.current_duration = next;
    if (!d.watched_counter.includes(seconds)) d.watched_counter.push(seconds);

    // Only write when the high-water mark actually advanced — avoids hammering
    // MySQL with one update every 5s of identical playback position.
    if (grew) {
        persist(async () => {
            const { LessonWatchProgress } = models();
            const [row, created] = await LessonWatchProgress.findOrCreate({
                where: { user_id: String(userId), lesson_id: lessonId },
                defaults: { user_id: String(userId), course_id: courseId, lesson_id: lessonId, current_duration: next },
            });
            if (!created && row.current_duration < next) {
                await row.update({ current_duration: next });
            }
        });
    }
    return d;
};

// Pull every persisted row into the in-memory cache. Call once at server boot.
const loadFromDb = async () => {
    const { LessonCompletion, LessonWatchProgress, UserProgress } = models();

    histories.length = 0;
    durations.length = 0;

    const [completions, progressRows, enrollments] = await Promise.all([
        LessonCompletion.findAll({ raw: true }),
        LessonWatchProgress.findAll({ raw: true }),
        UserProgress.findAll({ raw: true }),
    ]);

    // Group completed lessons by (user, course).
    const histKey = (uid, cid) => `${uid}::${cid}`;
    const histByKey = new Map();
    for (const c of completions) {
        const key = histKey(c.user_id, c.course_id);
        if (!histByKey.has(key)) {
            histByKey.set(key, {
                course_id: Number(c.course_id),
                student_id: Number(c.user_id),
                watching_lesson_id: null,
                completed_lesson: [],
            });
        }
        histByKey.get(key).completed_lesson.push(Number(c.lesson_id));
    }
    // Use last_lesson_id from user_progress as the resume point when we have one.
    for (const e of enrollments) {
        if (!e.course_id || !e.last_lesson_id) continue;
        const key = histKey(e.user_id, e.course_id);
        if (!histByKey.has(key)) {
            histByKey.set(key, {
                course_id: Number(e.course_id),
                student_id: Number(e.user_id),
                watching_lesson_id: Number(e.last_lesson_id),
                completed_lesson: [],
            });
        } else {
            histByKey.get(key).watching_lesson_id = Number(e.last_lesson_id);
        }
    }
    for (const v of histByKey.values()) histories.push(v);

    for (const p of progressRows) {
        durations.push({
            course_id: Number(p.course_id),
            lesson_id: Number(p.lesson_id),
            student_id: Number(p.user_id),
            current_duration: Number(p.current_duration) || 0,
            watched_counter: [Number(p.current_duration) || 0],
        });
    }

    return { histories: histories.length, durations: durations.length };
};

// DB-authoritative completed-lesson count per course for ONE user. Replaces the
// in-memory listHistoriesForUser for the stats/progress endpoints so they're
// correct across server instances and don't depend on the whole table being
// loaded into memory at boot. Returns [{ course_id, count }].
const completedCountsByCourse = async (userId) => {
    const uid = String(userId == null ? '' : userId).trim();
    if (!uid) return [];
    const { LessonCompletion } = models();
    const rows = await LessonCompletion.findAll({
        where: { user_id: uid },
        attributes: [
            'course_id',
            [LessonCompletion.sequelize.fn('COUNT', LessonCompletion.sequelize.col('id')), 'count'],
        ],
        group: ['course_id'],
        raw: true,
    });
    return rows.map((r) => ({ course_id: Number(r.course_id), count: Number(r.count) || 0 }));
};

module.exports = {
    getHistory,
    getHistoryDb,
    completedCountsByCourse,
    listHistoriesForUser,
    ensureHistory,
    setWatchingLesson,
    markLessonComplete,
    getDuration,
    upsertDuration,
    loadFromDb,
    flush,
};
