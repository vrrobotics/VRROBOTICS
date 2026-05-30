const { DataTypes } = require('sequelize');

// Gallery items shown on the public Home → Gallery page. Created/managed by
// admins via Gallery → Add/Manage Gallery. `media_type` distinguishes a photo
// card from the feature video; `media_url` is the public R2 image URL or the
// Bunny embed URL (both produced by helpers/fileUploader.upload).
module.exports = (sequelize) => {
    const Gallery = sequelize.define('Gallery', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        // 'image' | 'video'
        media_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'image' },
        // R2 public URL for images, Bunny embed URL for videos.
        media_url: { type: DataTypes.TEXT, allowNull: true },
        // Optional event date shown on the card (free text or ISO date).
        event_date: { type: DataTypes.STRING(100), allowNull: true },
        // Display ordering — lower shows first; ties break on newest.
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        // 1 = visible on the public site, 0 = hidden/draft.
        status: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    }, { tableName: 'gallery_items', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

    return Gallery;
};
