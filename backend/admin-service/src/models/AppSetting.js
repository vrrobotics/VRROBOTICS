const { DataTypes } = require('sequelize');

// Simple key/value store for admin-editable app settings (e.g. SMTP/email
// config set from the dashboard). DB values override .env at runtime.
module.exports = (sequelize) => sequelize.define('AppSetting', {
    key: { type: DataTypes.STRING(100), primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'app_settings', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
