const ttRepo = require('../repositories/TimetableEntryRepository');
const { HttpError } = require('../middlewares/error');

const PER_PAGE = 50;

// 0 = Monday … 6 = Sunday.
const toDay = (val) => {
    const n = Number(val);
    return Number.isInteger(n) && n >= 0 && n <= 6 ? n : 0;
};
// Keep only valid 'HH:mm' strings, else null.
const toTime = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    return /^\d{1,2}:\d{2}$/.test(s) ? s : null;
};

const list = async ({ page = 1 } = {}) => {
    const limit = PER_PAGE;
    const offset = (Number(page) - 1) * limit;
    try {
        const { count, rows } = await ttRepo.paginate({ limit, offset });
        return {
            entries: {
                data: rows,
                total: count,
                per_page: limit,
                current_page: Number(page),
                last_page: Math.max(1, Math.ceil(count / limit)),
            },
        };
    } catch (err) {
        console.warn('[timetable] DB query failed:', err.message);
        return { entries: { data: [], total: 0, per_page: limit, current_page: Number(page), last_page: 1 } };
    }
};

const get = async (id) => {
    const item = await ttRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Timetable entry not found.');
    return { item };
};

const create = async ({ body }) => {
    const item = await ttRepo.create({
        day_of_week: toDay(body.day_of_week),
        start_time: toTime(body.start_time),
        end_time: toTime(body.end_time),
        course_id: body.course_id ? String(body.course_id).trim() : null,
        teacher_id: body.teacher_id ? String(body.teacher_id).trim() : null,
        status: body.status === '0' || body.status === 0 ? 0 : 1,
    });
    return { success: 'Timetable entry created successfully.', item };
};

const update = async ({ id, body }) => {
    const item = await ttRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Timetable entry not found.');
    await item.update({
        day_of_week: body.day_of_week !== undefined ? toDay(body.day_of_week) : item.day_of_week,
        start_time: body.start_time !== undefined ? toTime(body.start_time) : item.start_time,
        end_time: body.end_time !== undefined ? toTime(body.end_time) : item.end_time,
        course_id: body.course_id !== undefined ? (body.course_id ? String(body.course_id).trim() : null) : item.course_id,
        teacher_id: body.teacher_id !== undefined ? (body.teacher_id ? String(body.teacher_id).trim() : null) : item.teacher_id,
        status: body.status !== undefined ? (body.status === '0' || body.status === 0 ? 0 : 1) : item.status,
    });
    return { success: 'Timetable entry updated successfully.', item };
};

const remove = async (id) => {
    const item = await ttRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Timetable entry not found.');
    await item.destroy();
    return { success: 'Timetable entry deleted successfully.' };
};

const toggleStatus = async (id) => {
    const item = await ttRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Timetable entry not found.');
    await item.update({ status: item.status ? 0 : 1 });
    return { success: 'Status updated', item };
};

// Timetable entries for a teacher, with course title resolved (teacher UI).
const listForTeacher = async (teacherId) => {
    if (!teacherId) return { entries: [] };
    try {
        const { resolveCourseTitles } = require('../helpers/scheduleResolve');
        const rows = await ttRepo.listForTeacher(teacherId);
        const titles = await resolveCourseTitles(rows.map((r) => r.course_id));
        const entries = rows.map((r) => ({
            id: r.id, day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time,
            course_id: r.course_id,
            course_title: r.course_id ? (titles[String(r.course_id)] || `Course #${r.course_id}`) : null,
        }));
        return { entries };
    } catch (err) {
        console.warn('[timetable] teacher entries failed:', err.message);
        return { entries: [] };
    }
};

module.exports = { list, get, create, update, remove, toggleStatus, listForTeacher };
