const { DataTypes } = require('sequelize');

// A Lead = someone who registered interest through the public portal but does
// NOT have a login yet. Admin/agents follow up and, when ready, Convert the
// lead into a real student account (which creates their login). Lives in
// lms_admin so it sits alongside the admin's other data; created on boot via
// the idempotent Model.sync() pattern.
module.exports = (sequelize) => {
    const Lead = sequelize.define('Lead', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(160), allowNull: false },
        email: { type: DataTypes.STRING(190), allowNull: false },
        phone: { type: DataTypes.STRING(40), allowNull: true },
        // Free-text "which course/program are you interested in".
        course_interest: { type: DataTypes.STRING(255), allowNull: true },
        // Where the lead came from — 'signup' for portal registrations.
        source: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'signup' },
        // Follow-up pipeline: new → contacted → converted | rejected.
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'new' },
        // Agent handling this lead (free-text name or userId) + their notes.
        assigned_to: { type: DataTypes.STRING(120), allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        // Set on Convert — the auth users.userId of the created student.
        converted_user_id: { type: DataTypes.STRING(64), allowNull: true },
        clg_id: { type: DataTypes.STRING(64), allowNull: true },
    }, {
        tableName: 'leads',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['status'] },
            { fields: ['email'] },
            { fields: ['created_at'] },
        ],
    });

    return Lead;
};
