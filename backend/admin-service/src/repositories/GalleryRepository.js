const { Op } = require('sequelize');
const { Gallery } = require('../models');

// Admin list (all statuses), newest first within sort_order.
const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.title = { [Op.iLike]: `%${search}%` };
    return Gallery.findAndCountAll({
        where,
        order: [['sort_order', 'ASC'], ['id', 'DESC']],
        limit,
        offset,
    });
};

// Public list — only visible items.
const listPublic = () =>
    Gallery.findAll({
        where: { status: 1 },
        order: [['sort_order', 'ASC'], ['id', 'DESC']],
    });

const findOne = (where) => Gallery.findOne({ where });
const create = (data) => Gallery.create(data);

module.exports = { paginate, listPublic, findOne, create };
