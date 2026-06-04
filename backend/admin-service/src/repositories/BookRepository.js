const { Op } = require('sequelize');
const { Book } = require('../models');

// Numbered items (sort_order > 0) first ascending; unset (0) items last,
// newest first — see GalleryRepository for the rationale.
const ORDER = () => [
    [Book.sequelize.literal('CASE WHEN "sort_order" = 0 THEN 1 ELSE 0 END'), 'ASC'],
    ['sort_order', 'ASC'],
    ['id', 'DESC'],
];

// Admin list (all statuses).
const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.title = { [Op.iLike]: `%${search}%` };
    return Book.findAndCountAll({
        where,
        order: ORDER(),
        limit,
        offset,
    });
};

// Public list — only visible items.
const listPublic = () =>
    Book.findAll({
        where: { status: 1 },
        order: ORDER(),
    });

const findOne = (where) => Book.findOne({ where });
const create = (data) => Book.create(data);

module.exports = { paginate, listPublic, findOne, create };
