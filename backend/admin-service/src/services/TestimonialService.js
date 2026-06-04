const testimonialRepo = require('../repositories/TestimonialRepository');
const { upload, removeFile, niceFileName } = require('../helpers/fileUploader');
const { HttpError } = require('../middlewares/error');

const PER_PAGE = 10;

const handleUpload = async (file, name) => {
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const destPath = `uploads/testimonials/${niceFileName(name || 'testimonial', ext)}`;
    return upload(file, destPath, 400, 400);
};

const list = async ({ page = 1, search } = {}) => {
    const limit = PER_PAGE;
    const offset = (Number(page) - 1) * limit;
    try {
        const { count, rows } = await testimonialRepo.paginate({ search, limit, offset });
        return {
            testimonials: {
                data: rows, total: count, per_page: limit,
                current_page: Number(page), last_page: Math.max(1, Math.ceil(count / limit)),
            },
        };
    } catch (err) {
        console.warn('[testimonials] DB query failed:', err.message);
        return { testimonials: { data: [], total: 0, per_page: limit, current_page: Number(page), last_page: 1 } };
    }
};

const listPublic = async () => {
    try {
        const rows = await testimonialRepo.listPublic();
        return rows.map((r) => r.toJSON());
    } catch (err) {
        console.warn('[testimonials] public query failed:', err.message);
        return [];
    }
};

const get = async (id) => {
    const item = await testimonialRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Testimonial not found.');
    return { item };
};

const create = async ({ body, file }) => {
    if (!body.message || !String(body.message).trim()) throw new HttpError(422, 'Message is required');
    if (!body.author_name || !String(body.author_name).trim()) throw new HttpError(422, 'Author name is required');
    const data = {
        message: String(body.message).trim(),
        author_name: String(body.author_name).trim(),
        role: body.role ? String(body.role).trim() : null,
        sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
        status: body.status === '0' || body.status === 0 ? 0 : 1,
        avatar_url: null,
    };
    if (file) data.avatar_url = await handleUpload(file, data.author_name);
    const item = await testimonialRepo.create(data);
    return { success: 'Testimonial created successfully.', item };
};

const update = async ({ id, body, file }) => {
    const item = await testimonialRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Testimonial not found.');
    const next = {
        message: body.message !== undefined ? String(body.message).trim() : item.message,
        author_name: body.author_name !== undefined ? String(body.author_name).trim() : item.author_name,
        role: body.role !== undefined ? (body.role ? String(body.role).trim() : null) : item.role,
        sort_order: body.sort_order !== undefined && Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : item.sort_order,
        status: body.status !== undefined ? (body.status === '0' || body.status === 0 ? 0 : 1) : item.status,
    };
    if (file) {
        if (item.avatar_url) { try { await removeFile(item.avatar_url); } catch (_e) { /* ignore */ } }
        next.avatar_url = await handleUpload(file, next.author_name);
    }
    await item.update(next);
    return { success: 'Testimonial updated successfully.', item };
};

const remove = async (id) => {
    const item = await testimonialRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Testimonial not found.');
    if (item.avatar_url) { try { await removeFile(item.avatar_url); } catch (_e) { /* ignore */ } }
    await item.destroy();
    return { success: 'Testimonial deleted successfully.' };
};

const toggleStatus = async (id) => {
    const item = await testimonialRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Testimonial not found.');
    await item.update({ status: item.status ? 0 : 1 });
    return { success: 'Status updated', item };
};

module.exports = { list, listPublic, get, create, update, remove, toggleStatus };
