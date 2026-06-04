const { TimetableEntry } = require('../models');

// Ordered by weekday then start time for a natural timetable layout.
const paginate = ({ limit, offset }) =>
    TimetableEntry.findAndCountAll({
        order: [['day_of_week', 'ASC'], ['start_time', 'ASC'], ['id', 'ASC']],
        limit,
        offset,
    });

const findOne = (where) => TimetableEntry.findOne({ where });
const create = (data) => TimetableEntry.create(data);

// Active timetable entries for a teacher (single teacher_id column).
const listForTeacher = (teacherId) =>
    TimetableEntry.findAll({
        where: { teacher_id: String(teacherId), status: 1 },
        order: [['day_of_week', 'ASC'], ['start_time', 'ASC'], ['id', 'ASC']],
        raw: true,
    });

module.exports = { paginate, findOne, create, listForTeacher };
