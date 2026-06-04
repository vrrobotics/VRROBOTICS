const { DataTypes } = require('sequelize');

// Scheduling slots created/managed by admins under Slots → Add/Manage Slots.
// A slot ties a course to a time window and a set of teachers + students.
// teacher_ids / student_ids hold the auth-service user ids (strings) as JSON
// arrays; course_id is the lms_admin course id (stored as string for safety).
module.exports = (sequelize) => {
    const Slot = sequelize.define('Slot', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(255), allowNull: false },
        // Single course this slot is for.
        course_id: { type: DataTypes.STRING(64), allowNull: true },
        // Time window for the slot.
        start_at: { type: DataTypes.DATE, allowNull: true },
        end_at: { type: DataTypes.DATE, allowNull: true },
        // Assigned auth-service user ids (role teacher / student) as JSON arrays.
        teacher_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        student_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        // Optional Google Meet / class URL for the slot.
        meeting_link: { type: DataTypes.TEXT, allowNull: true },
        // 1 = active, 0 = hidden/draft. SMALLINT (Postgres has no TINYINT).
        status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'slots', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return Slot;
};
