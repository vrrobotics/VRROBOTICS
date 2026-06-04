const { Op } = require('sequelize');
const { ClassSession } = require('../models');

const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.name = { [Op.iLike]: `%${search}%` };
    return ClassSession.findAndCountAll({
        where,
        order: [['start_at', 'ASC'], ['id', 'DESC']],
        limit,
        offset,
    });
};

const findOne = (where) => ClassSession.findOne({ where });
const create = (data) => ClassSession.create(data);

// Active class sessions whose teacher_ids JSONB array contains the teacher id.
const listForTeacher = (teacherId) => {
    const idJson = ClassSession.sequelize.escape(JSON.stringify([String(teacherId)]));
    return ClassSession.findAll({
        where: ClassSession.sequelize.literal(`status = 1 AND teacher_ids @> ${idJson}::jsonb`),
        order: [['start_at', 'ASC'], ['id', 'DESC']],
        raw: true,
    });
};

module.exports = { paginate, findOne, create, listForTeacher };
