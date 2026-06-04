const { DataTypes } = require('sequelize');

// Admin-managed categories for teaching resources (e.g. Coding, Maths,
// Science). Separate from course categories. Drives the category radio filter
// on the teacher Resources dashboard and the category dropdown when an admin
// uploads a resource.
module.exports = (sequelize) => {
    const ResourceCategory = sequelize.define('ResourceCategory', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(255), allowNull: false },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'resource_categories', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return ResourceCategory;
};
