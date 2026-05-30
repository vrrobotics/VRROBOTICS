const { Op } = require('sequelize');
const { User, Course } = require('../models');

const findById = (id) => User.findByPk(id);

const findByEmail = (email) => User.findOne({ where: { email } });

const findByIdAndRole = (id, role) => User.findOne({ where: { id, role } });

const findRootAdminId = async () => {
    // Explicit override: when ROOT_ADMIN_EMAIL is set, that account is THE root
    // admin (lands on /admin/dashboard). Lets a freshly-seeded branded admin be
    // root even if an older admin row has a lower id. Falls back to the legacy
    // "lowest-id admin" heuristic when unset / email not found.
    const rootEmail = process.env.ROOT_ADMIN_EMAIL;
    if (rootEmail) {
        const byEmail = await User.findOne({ where: { email: rootEmail }, attributes: ['id'] });
        if (byEmail) return byEmail.id;
    }
    const root = await User.findOne({ where: { role: 'admin' }, order: [['id', 'ASC']], attributes: ['id'] });
    return root ? root.id : null;
};

const buildSearchWhere = (role, search) => {
    const where = { role };
    if (search) {
        where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
        ];
    }
    return where;
};

const paginateByRole = (role, { search, limit, offset, order }) =>
    User.findAndCountAll({ where: buildSearchWhere(role, search), limit, offset, order });

const isEmailTaken = async (email, excludeId = null) => {
    const where = excludeId ? { email, id: { [Op.ne]: excludeId } } : { email };
    return Boolean(await User.findOne({ where }));
};

const create = (data) => User.create(data);

const courseCountFor = (userId) => Course.count({ where: { user_id: userId } });

const findInstructors = () =>
    User.findAll({
        where: { role: 'instructor' },
        attributes: ['id', 'name', 'email'],
        order: [['name', 'ASC']],
    });

const findUsersByIds = (ids) =>
    ids.length
        ? User.findAll({ where: { id: ids }, attributes: ['id', 'name', 'email', 'photo'] })
        : Promise.resolve([]);

module.exports = {
    findById,
    findByEmail,
    findByIdAndRole,
    findRootAdminId,
    paginateByRole,
    isEmailTaken,
    create,
    courseCountFor,
    findInstructors,
    findUsersByIds,
};
