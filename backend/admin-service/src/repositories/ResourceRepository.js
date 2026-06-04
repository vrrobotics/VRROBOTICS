const { Op } = require('sequelize');
const { Resource } = require('../models');

const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.title = { [Op.iLike]: `%${search}%` };
    return Resource.findAndCountAll({
        where,
        order: [['sort_order', 'ASC'], ['id', 'DESC']],
        limit,
        offset,
    });
};

const findOne = (where) => Resource.findOne({ where });
const create = (data) => Resource.create(data);

// Active resources assigned to a teacher (teacher_ids JSONB contains the id).
const listForTeacher = (teacherId) => {
    const idJson = Resource.sequelize.escape(JSON.stringify([String(teacherId)]));
    return Resource.findAll({
        where: Resource.sequelize.literal(`status = 1 AND teacher_ids @> ${idJson}::jsonb`),
        order: [['sort_order', 'ASC'], ['id', 'DESC']],
        raw: true,
    });
};

module.exports = { paginate, findOne, create, listForTeacher };
