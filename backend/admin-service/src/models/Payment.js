const { DataTypes } = require('sequelize');

// One row per purchase attempt of a course by a student. status:
//   created → order placed with Razorpay (not paid yet)
//   paid    → payment verified (checkout handler signature OR webhook)
//   failed  → Razorpay reported failure
// A `paid` row for (user_id, course_id) is what the paywall checks before
// serving paid-course lessons. user_id is VARCHAR to match the other tables
// (auth userIds are strings).
module.exports = (sequelize) => {
    const Payment = sequelize.define('Payment', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: { type: DataTypes.STRING(64), allowNull: false },
        course_id: { type: DataTypes.INTEGER, allowNull: false },
        // Amount in the smallest currency unit (paise for INR), matching Razorpay.
        amount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'INR' },
        status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'created' },
        razorpay_order_id: { type: DataTypes.STRING(64), allowNull: true },
        razorpay_payment_id: { type: DataTypes.STRING(64), allowNull: true },
    }, {
        tableName: 'payments',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['user_id', 'course_id'] },
            { fields: ['razorpay_order_id'] },
            { fields: ['status'] },
        ],
    });

    return Payment;
};
