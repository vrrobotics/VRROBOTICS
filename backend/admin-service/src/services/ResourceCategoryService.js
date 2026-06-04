const { ResourceCategory } = require('../models');
const { HttpError } = require('../middlewares/error');

// Numbered first (sort_order > 0) ascending; unset (0) last by id.
const ORDER = () => [
    [ResourceCategory.sequelize.literal('CASE WHEN "sort_order" = 0 THEN 1 ELSE 0 END'), 'ASC'],
    ['sort_order', 'ASC'],
    ['id', 'ASC'],
];

const list = async () => {
    try {
        const rows = await ResourceCategory.findAll({ order: ORDER() });
        return { categories: rows };
    } catch (e) {
        console.warn('[resource-categories] list failed:', e.message);
        return { categories: [] };
    }
};

const create = async (body) => {
    const name = body.name ? String(body.name).trim() : '';
    if (!name) throw new HttpError(422, 'Category name is required');
    const category = await ResourceCategory.create({
        name,
        sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
        status: body.status === '0' || body.status === 0 ? 0 : 1,
    });
    return { success: 'Resource category added', category };
};

const update = async (id, body) => {
    const category = await ResourceCategory.findByPk(id);
    if (!category) throw new HttpError(404, 'Category not found');
    const data = {};
    if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) throw new HttpError(422, 'Category name is required');
        data.name = name;
    }
    if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) data.sort_order = Number(body.sort_order);
    if (body.status !== undefined) data.status = body.status === '0' || body.status === 0 ? 0 : 1;
    await category.update(data);
    return { success: 'Resource category updated', category };
};

const remove = async (id) => {
    const category = await ResourceCategory.findByPk(id);
    if (!category) throw new HttpError(404, 'Category not found');
    await category.destroy();
    return { success: 'Resource category deleted' };
};

module.exports = { list, create, update, remove };
