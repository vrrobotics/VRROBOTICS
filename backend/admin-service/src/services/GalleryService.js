const galleryRepo = require('../repositories/GalleryRepository');
const { upload, removeFile, niceFileName } = require('../helpers/fileUploader');
const { HttpError } = require('../middlewares/error');

const PER_PAGE = 10;

// Upload an incoming file (image → R2, video → Bunny) and return the stored
// public URL + detected media type.
const handleUpload = async (file, title) => {
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const isVideo = (file.mimetype || '').startsWith('video/');
    const folder = isVideo ? 'gallery/videos' : 'gallery/images';
    const destPath = `uploads/${folder}/${niceFileName(title || 'gallery', ext)}`;
    const url = await upload(file, destPath, isVideo ? null : 1280, isVideo ? null : 720);
    return { media_url: url, media_type: isVideo ? 'video' : 'image' };
};

const list = async ({ page = 1, search } = {}) => {
    const limit = PER_PAGE;
    const offset = (Number(page) - 1) * limit;
    try {
        const { count, rows } = await galleryRepo.paginate({ search, limit, offset });
        return {
            gallery: {
                data: rows,
                total: count,
                per_page: limit,
                current_page: Number(page),
                last_page: Math.max(1, Math.ceil(count / limit)),
            },
        };
    } catch (err) {
        console.warn('[gallery] DB query failed:', err.message);
        return { gallery: { data: [], total: 0, per_page: limit, current_page: Number(page), last_page: 1 } };
    }
};

const listPublic = async () => {
    try {
        const rows = await galleryRepo.listPublic();
        return rows.map((r) => r.toJSON());
    } catch (err) {
        console.warn('[gallery] public query failed:', err.message);
        return [];
    }
};

const get = async (id) => {
    const item = await galleryRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Gallery item not found.');
    return { item };
};

const create = async ({ body, file }) => {
    if (!body.title || !String(body.title).trim()) {
        throw new HttpError(422, 'Title is required');
    }
    const data = {
        title: String(body.title).trim(),
        description: body.description ? String(body.description).trim() : null,
        event_date: body.event_date ? String(body.event_date).trim() : null,
        sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
        status: body.status === '0' || body.status === 0 ? 0 : 1,
        media_type: 'image',
        media_url: null,
    };
    if (file) {
        const up = await handleUpload(file, data.title);
        data.media_url = up.media_url;
        data.media_type = up.media_type;
    }
    const item = await galleryRepo.create(data);
    return { success: 'Gallery item created successfully.', item };
};

const update = async ({ id, body, file }) => {
    const item = await galleryRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Gallery item not found.');

    const next = {
        title: body.title !== undefined ? String(body.title).trim() : item.title,
        description: body.description !== undefined
            ? (body.description ? String(body.description).trim() : null)
            : item.description,
        event_date: body.event_date !== undefined
            ? (body.event_date ? String(body.event_date).trim() : null)
            : item.event_date,
        sort_order: body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
            ? Number(body.sort_order)
            : item.sort_order,
        status: body.status !== undefined
            ? (body.status === '0' || body.status === 0 ? 0 : 1)
            : item.status,
    };

    if (file) {
        // Replace media: remove the old asset (best-effort) then upload new.
        if (item.media_url) { try { await removeFile(item.media_url); } catch (_e) { /* ignore */ } }
        const up = await handleUpload(file, next.title);
        next.media_url = up.media_url;
        next.media_type = up.media_type;
    }

    await item.update(next);
    return { success: 'Gallery item updated successfully.', item };
};

const remove = async (id) => {
    const item = await galleryRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Gallery item not found.');
    if (item.media_url) { try { await removeFile(item.media_url); } catch (_e) { /* ignore */ } }
    await item.destroy();
    return { success: 'Gallery item deleted successfully.' };
};

const toggleStatus = async (id) => {
    const item = await galleryRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Gallery item not found.');
    await item.update({ status: item.status ? 0 : 1 });
    return { success: 'Status updated', item };
};

module.exports = { list, listPublic, get, create, update, remove, toggleStatus };
