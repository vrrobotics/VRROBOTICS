const { DataTypes } = require('sequelize');

// Flexible per-student record authored by a teacher. One table backs every
// Students-panel sub-feature via `kind` + a JSON `data` payload:
//   kind = 'goal_primary' | 'goal_academic' | 'badge' | 'spr' | 'mark'
//        | 'exercise' | 'quiz' | 'project'
// Examples of `data`:
//   goal_academic → { subject, grade, goal }
//   badge         → { badge: 'homework_hero', status: 'assigned' }
//   spr           → { note }
//   mark          → { subject, score, total }
//   project       → { title, type: 'mini'|'major'|'final' }
module.exports = (sequelize) => {
    const StudentRecord = sequelize.define('StudentRecord', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        teacher_id: { type: DataTypes.STRING(64), allowNull: false },
        student_id: { type: DataTypes.STRING(64), allowNull: false },
        kind: { type: DataTypes.STRING(32), allowNull: false },
        data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    }, { tableName: 'student_records', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return StudentRecord;
};
