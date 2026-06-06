const { DataTypes } = require('sequelize');

// The roster of a teaching_assignment. Deliberately unifies the two ways a
// teacher gets students so the rest of the system has ONE concept ("audience"):
//   member_type = 'batch'   → member_ref = batches.id          (a whole cohort)
//   member_type = 'student' → member_ref = users.userId        (one loose student)
//
// Resolving an assignment's students = expand every 'batch' row via
// batch_members ∪ every 'student' row. The "one teacher per student per
// course" rule is enforced in the service at add time, not by a DB constraint
// (batch expansion can't be expressed as a simple unique index).
module.exports = (sequelize) => {
    const AssignmentMember = sequelize.define('AssignmentMember', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        teaching_assignment_id: { type: DataTypes.INTEGER, allowNull: false },
        member_type: { type: DataTypes.STRING(16), allowNull: false }, // 'batch' | 'student'
        // Stored as string so it holds both a batch id (numeric) and a
        // user_id (large numeric string) without a type clash.
        member_ref: { type: DataTypes.STRING(64), allowNull: false },
    }, {
        tableName: 'assignment_members',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['teaching_assignment_id', 'member_type', 'member_ref'] },
            { fields: ['member_type', 'member_ref'] },
        ],
    });

    return AssignmentMember;
};
