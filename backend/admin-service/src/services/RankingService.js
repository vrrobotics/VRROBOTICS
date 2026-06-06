const { Op, QueryTypes } = require('sequelize');
const { LessonCompletion, QuizSubmission, Lesson } = require('../models');
const authDb = require('../config/authDatabase');
const cache = require('../config/cache');

// The full ranking aggregation is the expensive part and is SHARED across all
// users, so it's cached. Per-request work (top-N slice, "me", name hydration)
// stays fresh. TTL is short enough that the board feels live.
const RANK_TTL = 120; // seconds

// Student ranking / leaderboard.
//   score = completed_lessons × W_COMPLETION + quiz_points × W_QUIZ
//   quiz_points = sum of the BEST score per quiz (so re-attempting can't inflate
//   rank by stacking attempts). Aggregates live in lms_admin; names are
//   hydrated from the auth DB (lucy_devdb.users) in a second step (no cross-DB
//   join). Computed on request — cache later if it gets hot.
const W_COMPLETION = 10;
const W_QUIZ = 5;

// completed lessons per user (optional course filter) → Map<user_id, count>.
const completionsByUser = async (courseId) => {
    const where = courseId ? { course_id: Number(courseId) } : {};
    const rows = await LessonCompletion.findAll({
        where,
        attributes: ['user_id', [LessonCompletion.sequelize.fn('COUNT', LessonCompletion.sequelize.col('id')), 'n']],
        group: ['user_id'],
        raw: true,
    });
    const m = new Map();
    for (const r of rows) m.set(String(r.user_id), Number(r.n) || 0);
    return m;
};

// best quiz score per (user, quiz), summed per user (optional course filter)
// → Map<user_id, points>.
const quizPointsByUser = async (courseId) => {
    let where = {};
    if (courseId) {
        const quizzes = await Lesson.findAll({
            where: { course_id: Number(courseId), lesson_type: 'quiz' },
            attributes: ['id'],
            raw: true,
        });
        const ids = quizzes.map((l) => l.id);
        if (!ids.length) return new Map();
        where = { quiz_id: { [Op.in]: ids } };
    }
    const rows = await QuizSubmission.findAll({
        where,
        attributes: ['user_id', 'quiz_id', [QuizSubmission.sequelize.fn('MAX', QuizSubmission.sequelize.col('score')), 'best']],
        group: ['user_id', 'quiz_id'],
        raw: true,
    });
    const m = new Map();
    for (const r of rows) {
        const uid = String(r.user_id);
        m.set(uid, (m.get(uid) || 0) + (Number(r.best) || 0));
    }
    return m;
};

const hydrateNames = async (userIds) => {
    const ids = [...new Set(userIds.map(String).filter(Boolean))];
    if (!ids.length) return {};
    try {
        const rows = await authDb.query(
            'SELECT u."userId" AS id, u.name FROM users u WHERE u."userId" IN (:ids)',
            { replacements: { ids }, type: QueryTypes.SELECT },
        );
        const by = {};
        for (const r of rows) by[String(r.id)] = r.name;
        return by;
    } catch (e) {
        console.warn('[ranking] name hydrate failed:', e.message);
        return {};
    }
};

// The expensive, SHARED part: the full sorted ranking (all users, no names).
// Cached so concurrent leaderboard loads don't each re-scan completions+quizzes.
const rankRows = async (courseId) => {
    const key = `lb:rows:${courseId ? `c:${courseId}` : 'overall'}`;
    return cache.wrap(key, RANK_TTL, async () => {
        const [comp, quiz] = await Promise.all([completionsByUser(courseId), quizPointsByUser(courseId)]);
        const userIds = new Set([...comp.keys(), ...quiz.keys()]);
        const rows = [...userIds].map((uid) => {
            const completed = comp.get(uid) || 0;
            const quizPoints = quiz.get(uid) || 0;
            return { user_id: uid, completed, quiz_points: quizPoints, score: completed * W_COMPLETION + quizPoints * W_QUIZ };
        });
        rows.sort((a, b) => b.score - a.score || b.completed - a.completed);
        rows.forEach((r, i) => { r.rank = i + 1; });
        return rows;
    });
};

// Build a leaderboard. courseId null = overall. Returns top `limit` plus the
// requesting student's own rank (`me`), even if outside the top.
const build = async ({ courseId = null, limit = 50, meUserId = null } = {}) => {
    const cap = Math.max(1, Math.min(Number(limit) || 50, 100));
    const rows = await rankRows(courseId);

    let me = null;
    if (meUserId) {
        const mid = String(meUserId);
        me = rows.find((r) => r.user_id === mid)
            || { user_id: mid, completed: 0, quiz_points: 0, score: 0, rank: rows.length + 1 };
    }

    const top = rows.slice(0, cap);
    const names = await hydrateNames([...top.map((r) => r.user_id), ...(me ? [me.user_id] : [])]);
    top.forEach((r) => { r.name = names[r.user_id] || `Student ${r.user_id}`; });
    if (me) me.name = names[me.user_id] || `Student ${me.user_id}`;

    return {
        scope: courseId ? 'course' : 'overall',
        course_id: courseId ? Number(courseId) : null,
        total_ranked: rows.length,
        weights: { completion: W_COMPLETION, quiz: W_QUIZ },
        leaderboard: top,
        me,
    };
};

module.exports = { build };
