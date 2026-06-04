const { Op } = require('sequelize');
const { Slot } = require('../models');

// Admin list (all statuses), upcoming first then newest.
const paginate = ({ search, limit, offset }) => {
    const where = {};
    if (search) where.name = { [Op.iLike]: `%${search}%` };
    return Slot.findAndCountAll({
        where,
        order: [['start_at', 'ASC'], ['id', 'DESC']],
        limit,
        offset,
    });
};

const findOne = (where) => Slot.findOne({ where });
const create = (data) => Slot.create(data);

module.exports = { paginate, findOne, create };
