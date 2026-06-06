const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PreAssessmentResult = sequelize.define('PreAssessmentResult', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        // VARCHAR in the live DB (auth userIds; different DB, no FK). Was BIGINT,
        // which mismatches the column and can silently fail result writes/reads.
        user_id: { type: DataTypes.STRING(64), allowNull: false },
        program_id: { type: DataTypes.INTEGER, allowNull: true },
        score: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
        passed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        // Seconds the student spent on the assessment (timer start → submit),
        // sent by the frontend. Null for older rows submitted before tracking.
        duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
    }, {
        tableName: 'pre_assessment_results',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [{ fields: ['user_id', 'program_id'] }],
    });

    return PreAssessmentResult;
};
