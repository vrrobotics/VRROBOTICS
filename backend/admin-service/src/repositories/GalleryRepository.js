const { Op } = require('sequelize');
const { Gallery } = require('../models');

// Ordering: explicitly-numbered items (sort_order > 0) come first, ascending
// (1, 2, 3…); items left at the default 0 ("unset") fall to the END, newest
// first. This matches the intuitive expectation that setting a number moves an
// item UP, rather than sending it below all the un-numbered (0) items.
const ORDER = () => [
    [Gallery.sequelize.literal('CASE WHEN "sort_order" = 0 THEN 1 ELSE 0 END'), 'ASC'],
    ['sort_order', 'ASC'],
    ['id', 'DESC'],
];

// Admin list (all statuses).
const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.title = { [Op.iLike]: `%${search}%` };
    return Gallery.findAndCountAll({
        where,
        order: ORDER(),
        limit,
        offset,
    });
};

// Public list — only visible items.
const listPublic = () =>
    Gallery.findAll({
        where: { status: 1 },
        order: ORDER(),
    });

const findOne = (where) => Gallery.findOne({ where });
const create = (data) => Gallery.create(data);

module.exports = { paginate, listPublic, findOne, create };
