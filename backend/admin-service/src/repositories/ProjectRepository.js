const { Op } = require('sequelize');
const { Project } = require('../models');

// Numbered items (sort_order > 0) first ascending; unset (0) items last,
// newest first — see GalleryRepository for the rationale.
const ORDER = () => [
    [Project.sequelize.literal('CASE WHEN "sort_order" = 0 THEN 1 ELSE 0 END'), 'ASC'],
    ['sort_order', 'ASC'],
    ['id', 'DESC'],
];

const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.title = { [Op.iLike]: `%${search}%` };
    return Project.findAndCountAll({
        where,
        order: ORDER(),
        limit,
        offset,
    });
};

const listPublic = () =>
    Project.findAll({ where: { status: 1 }, order: ORDER() });

const findOne = (where) => Project.findOne({ where });
const create = (data) => Project.create(data);

module.exports = { paginate, listPublic, findOne, create };
