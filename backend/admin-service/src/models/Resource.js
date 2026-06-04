const { DataTypes } = require('sequelize');

// Teaching resources created by admins under Resources → Add/Manage. A resource
// is a TITLE plus one-or-more PDF files (uploaded to Cloudflare R2; only the
// public URLs are stored here), assigned to one-or-more teachers. It shows on
// each assigned teacher's dashboard Resources tab. Independent of course
// creation — this is a standalone resource library.
module.exports = (sequelize) => {
    const Resource = sequelize.define('Resource', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        // [{ name, url }] — R2 public URLs for the uploaded PDFs.
        files: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        // Resource category (resource_categories.id) — drives the category
        // radio filter on the teacher dashboard. Nullable for legacy rows.
        resource_category_id: { type: DataTypes.INTEGER, allowNull: true },
        // Course (courses.id) this resource belongs to — the teacher's course
        // dropdown filters by it. Nullable for legacy rows.
        course_id: { type: DataTypes.INTEGER, allowNull: true },
        // Free-text section name (e.g. "Lesson Plans", "Visual Aids"). The
        // teacher dashboard groups resource cards under these section headers.
        section: { type: DataTypes.STRING(255), allowNull: true },
        // Auth-service teacher user ids this resource is assigned to.
        teacher_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'resources', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return Resource;
};
