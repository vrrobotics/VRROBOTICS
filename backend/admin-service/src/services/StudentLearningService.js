const { StudentLearning } = require('../models');
const { HttpError } = require('../middlewares/error');

// The student's note for one lesson (or null if none yet).
const getOne = async (studentId, lessonId) => {
    if (!studentId || !lessonId) return { learning: null };
    try {
        const row = await StudentLearning.findOne({
            where: { student_id: String(studentId), lesson_id: Number(lessonId) },
            raw: true,
        });
        return { learning: row || null };
    } catch (e) {
        console.warn('[learnings] get failed:', e.message);
        return { learning: null };
    }
};

// Upsert (one row per student+lesson).
const save = async (body) => {
    const studentId = body.studentId || body.student_id;
    const lessonId = Number(body.lessonId || body.lesson_id);
    if (!studentId || !Number.isFinite(lessonId)) throw new HttpError(422, 'studentId and lessonId are required');
    const fields = {
        course_id: Number.isFinite(Number(body.courseId || body.course_id)) ? Number(body.courseId || body.course_id) : null,
        title: body.title != null ? String(body.title).trim() : null,
        description: body.description != null ? String(body.description).trim() : null,
    };
    const existing = await StudentLearning.findOne({ where: { student_id: String(studentId), lesson_id: lessonId } });
    if (existing) {
        await existing.update(fields);
        return { success: 'Saved', learning: existing };
    }
    const row = await StudentLearning.create({ student_id: String(studentId), lesson_id: lessonId, ...fields });
    return { success: 'Saved', learning: row };
};

module.exports = { getOne, save };
