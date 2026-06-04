const { Op } = require('sequelize');
const { Testimonial } = require('../models');

// Numbered items (sort_order > 0) first ascending; unset (0) items last,
// newest first — see GalleryRepository for the rationale.
const ORDER = () => [
    [Testimonial.sequelize.literal('CASE WHEN "sort_order" = 0 THEN 1 ELSE 0 END'), 'ASC'],
    ['sort_order', 'ASC'],
    ['id', 'DESC'],
];

const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.author_name = { [Op.iLike]: `%${search}%` };
    return Testimonial.findAndCountAll({
        where,
        order: ORDER(),
        limit,
        offset,
    });
};

const listPublic = () =>
    Testimonial.findAll({ where: { status: 1 }, order: ORDER() });

const findOne = (where) => Testimonial.findOne({ where });
const create = (data) => Testimonial.create(data);

module.exports = { paginate, listPublic, findOne, create };
