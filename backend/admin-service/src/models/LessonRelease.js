const { DataTypes } = require('sequelize');

// One row = "this lesson is released to this teaching_assignment's roster".
// This is the teacher's daily drip: the teacher never hands over the whole
// course — they release a lesson (today's video / assignment) and it becomes
// visible to every student on that assignment's roster.
//
// Optimization: a release targets the ASSIGNMENT, not each student. Releasing
// today's video to a 100-student batch is ONE row, not 100. Visibility is
// computed at read time (released_at <= NOW() AND revoked_at IS NULL), so the
// teacher can also schedule a future release without any cron.
module.exports = (sequelize) => {
    const LessonRelease = sequelize.define('LessonRelease', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        teaching_assignment_id: { type: DataTypes.INTEGER, allowNull: false },
        lesson_id: { type: DataTypes.INTEGER, allowNull: false },
        // Denormalized for fast "is this lesson released for this course" reads
        // without joining back through the assignment.
        course_id: { type: DataTypes.INTEGER, allowNull: false },
        // auth users.userId of whoever released it (teacher or admin) — audit.
        released_by: { type: DataTypes.STRING(64), allowNull: true },
        // When it becomes visible. Defaults to now; set to a future time to
        // schedule. NULL revoked_at = active.
        released_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        revoked_at: { type: DataTypes.DATE, allowNull: true },
    }, {
        tableName: 'lesson_releases',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['teaching_assignment_id', 'lesson_id'] },
            { fields: ['course_id'] },
            { fields: ['teaching_assignment_id'] },
        ],
    });

    return LessonRelease;
};
