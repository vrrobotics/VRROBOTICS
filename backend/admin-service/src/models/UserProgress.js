const { DataTypes } = require('sequelize');

// Tracks a user's progress through a program: which program they picked, which
// course they enrolled in, and the last lesson they watched. One row per
// (user_id, program_id) — user can hold one enrollment per program.
module.exports = (sequelize) => {
    const UserProgress = sequelize.define('UserProgress', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        // VARCHAR in the live DB (auth userIds stored as strings). The model used
        // to declare BIGINT, which made Sequelize emit "varchar = bigint" and
        // silently fail every progress query. Strings preserve the full id too.
        user_id: { type: DataTypes.STRING(64), allowNull: false },
        program_id: { type: DataTypes.INTEGER, allowNull: false },
        course_id: { type: DataTypes.INTEGER, allowNull: true },
        last_lesson_id: { type: DataTypes.INTEGER, allowNull: true },
        enrolled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    }, {
        tableName: 'user_progress',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['user_id', 'program_id'] },
            { fields: ['user_id'] },
        ],
    });

    return UserProgress;
};
