const { DataTypes } = require('sequelize');

// A student's own "My Learnings" note for a specific lesson (title + free-text
// notes). One row per (student_id, lesson_id) — upserted as the student edits.
// Authored by the student from the course player; independent of teacher data.
module.exports = (sequelize) => {
    const StudentLearning = sequelize.define('StudentLearning', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        student_id: { type: DataTypes.STRING(64), allowNull: false },
        course_id: { type: DataTypes.INTEGER, allowNull: true },
        lesson_id: { type: DataTypes.INTEGER, allowNull: false },
        title: { type: DataTypes.STRING(255), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
    }, { tableName: 'student_learnings', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return StudentLearning;
};
