const { DataTypes } = require('sequelize');

// Teacher-authored weekly availability ("Free Schedule"). Each row is one
// time window the teacher marks themselves free on a given weekday. Managed by
// the teacher from their dashboard (add/remove chips). day_of_week: 0=Monday …
// 6=Sunday; start_time/end_time are 'HH:mm' strings.
module.exports = (sequelize) => {
    const TeacherFreeSchedule = sequelize.define('TeacherFreeSchedule', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        teacher_id: { type: DataTypes.STRING(64), allowNull: false },
        day_of_week: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
        start_time: { type: DataTypes.STRING(10), allowNull: false },
        end_time: { type: DataTypes.STRING(10), allowNull: false },
    }, { tableName: 'teacher_free_schedule', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return TeacherFreeSchedule;
};
