const { DataTypes } = require('sequelize');

// Student projects shown on the public Home → "Student Projects" section.
// Created/managed by admins under Projects → Add/Manage. image_url is the R2
// public URL (helpers/fileUploader.upload). author_name is the student's name.
module.exports = (sequelize) => {
    const Project = sequelize.define('Project', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        author_name: { type: DataTypes.STRING(255), allowNull: true },
        // Free text or ISO date shown on the card (e.g. "AUG 18, 2024").
        project_date: { type: DataTypes.STRING(100), allowNull: true },
        image_url: { type: DataTypes.TEXT, allowNull: true },
        // Optional "view project" link.
        link_url: { type: DataTypes.TEXT, allowNull: true },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        // 1 = visible on the public site, 0 = hidden. SMALLINT (no TINYINT on PG).
        status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'projects', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return Project;
};
