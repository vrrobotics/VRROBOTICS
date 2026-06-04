const { DataTypes } = require('sequelize');

// Testimonials shown on the public Home → "What parents & students have to say"
// section. Created/managed by admins under Testimonials → Add/Manage.
// avatar_url is the R2 public URL (optional).
module.exports = (sequelize) => {
    const Testimonial = sequelize.define('Testimonial', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        // The quote/message.
        message: { type: DataTypes.TEXT, allowNull: false },
        author_name: { type: DataTypes.STRING(255), allowNull: false },
        // e.g. "Student, Grade 6" or "Parent".
        role: { type: DataTypes.STRING(255), allowNull: true },
        avatar_url: { type: DataTypes.TEXT, allowNull: true },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        // 1 = visible on the public site, 0 = hidden. SMALLINT (no TINYINT on PG).
        status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'testimonials', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return Testimonial;
};
