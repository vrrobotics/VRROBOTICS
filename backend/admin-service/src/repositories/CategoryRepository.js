const { Op } = require('sequelize');
const { Category } = require('../models');

const findRootWithChildren = () =>
    Category.findAll({
        where: { parent_id: null },
        include: [{ model: Category, as: 'childs' }],
        order: [['sort', 'ASC']],
    });

// College-scoped variant. Returns only categories whose clg_ids JSONB array
// contains the given clgId — applied to BOTH parents and their children so a
// student never sees another school's category at any level. We use the
// Postgres JSONB `@>` (contains) operator via a sequelize.literal; the value
// is escaped to prevent injection from the query string.
const findRootWithChildrenForCollege = (clgId) => {
    // @> needs a JSON array on the RHS for "contains element X".
    const escaped = Category.sequelize.escape(JSON.stringify([String(clgId)]));
    // Parent rows: Sequelize quotes table aliases as "Category" by default
    // on Postgres. JSONB operators are case-sensitive so the cast is required.
    const parentContains = Category.sequelize.literal(
        `"Category"."clg_ids" @> ${escaped}::jsonb`
    );
    // Child rows: the include alias is `childs`.
    const childContains = Category.sequelize.literal(
        `"childs"."clg_ids" @> ${escaped}::jsonb`
    );
    return Category.findAll({
        where: {
            parent_id: null,
            [Op.and]: [parentContains],
        },
        include: [
            {
                model: Category,
                as: 'childs',
                required: false,
                where: { [Op.and]: [childContains] },
            },
        ],
        order: [['sort', 'ASC']],
    });
};

const findById = (id) => Category.findByPk(id);

const findBySlug = (slug) => Category.findOne({ where: { slug } });

const findChildrenOf = (parentId) => Category.findAll({ where: { parent_id: parentId } });

const findChildrenIds = async (parentId) => {
    const subs = await Category.findAll({ where: { parent_id: parentId }, attributes: ['id'] });
    return subs.map((s) => s.id);
};

const isSlugTaken = async (slug, excludeId = null) => {
    const where = excludeId ? { slug, id: { [Op.ne]: excludeId } } : { slug };
    return Boolean(await Category.count({ where }));
};

const create = (data) => Category.create(data);

module.exports = {
    findRootWithChildren,
    findRootWithChildrenForCollege,
    findById,
    findBySlug,
    findChildrenOf,
    findChildrenIds,
    isSlugTaken,
    create,
};
