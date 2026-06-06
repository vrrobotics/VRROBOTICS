const { DataTypes } = require('sequelize');

// A teaching assignment delegates ONE course to ONE teacher. This is the
// admin → teacher hand-off: "Teacher A teaches Course X". Per the agreed
// model the relationship is PER-COURSE, so a single course may have several
// teaching_assignments (different teachers each owning a different slice of
// students). It does NOT replace courses.teacherId — that legacy single-owner
// column stays untouched; this table sits alongside it for delegated rosters.
//
// The roster (which students) lives in assignment_members; the daily drip
// (which lessons are released) lives in lesson_releases.
module.exports = (sequelize) => {
    const TeachingAssignment = sequelize.define('TeachingAssignment', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        course_id: { type: DataTypes.INTEGER, allowNull: false },
        // auth-service users.userId of the teacher (string PK — 11-digit
        // numerics overflow INT, mirrors BatchMember.user_id).
        teacher_id: { type: DataTypes.STRING(64), allowNull: false },
        // College that owns this assignment (colleges.clgId in lucy_devdb).
        // Lets a college admin list/scope only their own assignments.
        clg_id: { type: DataTypes.STRING(64), allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    }, {
        tableName: 'teaching_assignments',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            // One row per (course, teacher) — re-assigning is idempotent.
            { unique: true, fields: ['course_id', 'teacher_id'] },
            { fields: ['course_id'] },
            { fields: ['teacher_id'] },
            { fields: ['clg_id'] },
        ],
    });

    return TeachingAssignment;
};
