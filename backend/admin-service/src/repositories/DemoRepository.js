const { Op } = require('sequelize');
const { Demo } = require('../models');

const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.title = { [Op.iLike]: `%${search}%` };
    return Demo.findAndCountAll({
        where,
        order: [['start_at', 'ASC'], ['id', 'DESC']],
        limit,
        offset,
    });
};

const findOne = (where) => Demo.findOne({ where });
const create = (data) => Demo.create(data);

// Active demos whose teacher_ids JSONB array contains the given teacher id.
const listForTeacher = (teacherId) => {
    const idJson = Demo.sequelize.escape(JSON.stringify([String(teacherId)]));
    return Demo.findAll({
        where: Demo.sequelize.literal(`status = 1 AND teacher_ids @> ${idJson}::jsonb`),
        order: [['start_at', 'ASC'], ['id', 'DESC']],
        raw: true,
    });
};

module.exports = { paginate, findOne, create, listForTeacher };
