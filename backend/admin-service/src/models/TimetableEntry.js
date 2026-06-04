const { DataTypes } = require('sequelize');

// Weekly-recurring timetable entries managed by admins under Time table →
// Add/Manage. day_of_week is 0=Monday … 6=Sunday; start_time/end_time are
// 'HH:mm' strings. A single course + teacher per entry.
module.exports = (sequelize) => {
    const TimetableEntry = sequelize.define('TimetableEntry', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        day_of_week: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
        start_time: { type: DataTypes.STRING(5), allowNull: true },
        end_time: { type: DataTypes.STRING(5), allowNull: true },
        course_id: { type: DataTypes.STRING(64), allowNull: true },
        teacher_id: { type: DataTypes.STRING(64), allowNull: true },
        // 1 = active, 0 = hidden. SMALLINT (Postgres has no TINYINT).
        status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'timetable_entries', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return TimetableEntry;
};
