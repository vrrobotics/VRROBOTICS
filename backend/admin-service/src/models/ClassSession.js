const { DataTypes } = require('sequelize');

// Class sessions managed by admins under Classes → Add/Manage Classes.
// Table is `class_sessions` (avoids the SQL-reserved word "class"). A class
// ties a course to a time window, teacher(s), student(s) and a meeting link.
module.exports = (sequelize) => {
    const ClassSession = sequelize.define('ClassSession', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(255), allowNull: false },
        course_id: { type: DataTypes.STRING(64), allowNull: true },
        start_at: { type: DataTypes.DATE, allowNull: true },
        end_at: { type: DataTypes.DATE, allowNull: true },
        teacher_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        student_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        meeting_link: { type: DataTypes.TEXT, allowNull: true },
        // 1 = active, 0 = hidden. SMALLINT (Postgres has no TINYINT).
        status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'class_sessions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return ClassSession;
};
