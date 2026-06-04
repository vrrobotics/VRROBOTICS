const { TeacherFreeSchedule } = require('../models');
const { HttpError } = require('../middlewares/error');

const toDay = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 6 ? n : 0;
};
const toTime = (v) => {
    const s = String(v || '').trim();
    return /^\d{1,2}:\d{2}$/.test(s) ? s : null;
};

const listForTeacher = async (teacherId) => {
    if (!teacherId) return { schedule: [] };
    try {
        const rows = await TeacherFreeSchedule.findAll({
            where: { teacher_id: String(teacherId) },
            order: [['day_of_week', 'ASC'], ['start_time', 'ASC']],
            raw: true,
        });
        return { schedule: rows };
    } catch (e) {
        console.warn('[free-schedule] list failed:', e.message);
        return { schedule: [] };
    }
};

const create = async (body) => {
    const teacherId = body.teacherId || body.teacher_id;
    if (!teacherId) throw new HttpError(422, 'teacherId is required');
    const start_time = toTime(body.start_time);
    const end_time = toTime(body.end_time);
    if (!start_time || !end_time) throw new HttpError(422, 'Valid start_time and end_time (HH:mm) are required');
    // Reject reversed/equal windows (HH:mm sorts lexicographically == chronologically).
    if (end_time <= start_time) throw new HttpError(422, 'End time must be after start time');
    const item = await TeacherFreeSchedule.create({
        teacher_id: String(teacherId),
        day_of_week: toDay(body.day_of_week),
        start_time,
        end_time,
    });
    return { success: 'Schedule added', item };
};

const remove = async (id, teacherId) => {
    const row = await TeacherFreeSchedule.findByPk(id);
    if (!row) throw new HttpError(404, 'Not found');
    // Scope deletes to the owning teacher so one teacher can't delete another's.
    if (teacherId && String(row.teacher_id) !== String(teacherId)) {
        throw new HttpError(403, 'Not allowed');
    }
    await row.destroy();
    return { success: 'Schedule removed' };
};

const removeAllForTeacher = async (teacherId) => {
    if (!teacherId) throw new HttpError(422, 'teacherId is required');
    await TeacherFreeSchedule.destroy({ where: { teacher_id: String(teacherId) } });
    return { success: 'All schedule cleared' };
};

module.exports = { listForTeacher, create, remove, removeAllForTeacher };
