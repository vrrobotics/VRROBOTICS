const { DataTypes } = require('sequelize');

// Demo sessions managed by admins under Demos → Add/Manage Demos.
// A demo is a lightweight scheduled demo class: title + course + time window
// + assigned teacher(s). teacher_ids holds auth-service user ids as JSON.
module.exports = (sequelize) => {
    const Demo = sequelize.define('Demo', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        course_id: { type: DataTypes.STRING(64), allowNull: true },
        start_at: { type: DataTypes.DATE, allowNull: true },
        end_at: { type: DataTypes.DATE, allowNull: true },
        teacher_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        meeting_link: { type: DataTypes.TEXT, allowNull: true },
        // 1 = active, 0 = hidden. SMALLINT (Postgres has no TINYINT).
        status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'demos', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return Demo;
};
