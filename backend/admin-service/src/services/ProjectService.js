const projectRepo = require('../repositories/ProjectRepository');
const { upload, removeFile, niceFileName } = require('../helpers/fileUploader');
const { HttpError } = require('../middlewares/error');

const PER_PAGE = 10;

// Upload the project image → R2 and return the public URL.
const handleUpload = async (file, title) => {
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const destPath = `uploads/projects/${niceFileName(title || 'project', ext)}`;
    return upload(file, destPath, 1280, 720);
};

const list = async ({ page = 1, search } = {}) => {
    const limit = PER_PAGE;
    const offset = (Number(page) - 1) * limit;
    try {
        const { count, rows } = await projectRepo.paginate({ search, limit, offset });
        return {
            projects: {
                data: rows, total: count, per_page: limit,
                current_page: Number(page), last_page: Math.max(1, Math.ceil(count / limit)),
            },
        };
    } catch (err) {
        console.warn('[projects] DB query failed:', err.message);
        return { projects: { data: [], total: 0, per_page: limit, current_page: Number(page), last_page: 1 } };
    }
};

const listPublic = async () => {
    try {
        const rows = await projectRepo.listPublic();
        return rows.map((r) => r.toJSON());
    } catch (err) {
        console.warn('[projects] public query failed:', err.message);
        return [];
    }
};

const get = async (id) => {
    const item = await projectRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Project not found.');
    return { item };
};

const create = async ({ body, file }) => {
    if (!body.title || !String(body.title).trim()) throw new HttpError(422, 'Title is required');
    const data = {
        title: String(body.title).trim(),
        description: body.description ? String(body.description).trim() : null,
        author_name: body.author_name ? String(body.author_name).trim() : null,
        project_date: body.project_date ? String(body.project_date).trim() : null,
        link_url: body.link_url ? String(body.link_url).trim() : null,
        sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
        status: body.status === '0' || body.status === 0 ? 0 : 1,
        image_url: null,
    };
    if (file) data.image_url = await handleUpload(file, data.title);
    const item = await projectRepo.create(data);
    return { success: 'Project created successfully.', item };
};

const update = async ({ id, body, file }) => {
    const item = await projectRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Project not found.');
    const next = {
        title: body.title !== undefined ? String(body.title).trim() : item.title,
        description: body.description !== undefined ? (body.description ? String(body.description).trim() : null) : item.description,
        author_name: body.author_name !== undefined ? (body.author_name ? String(body.author_name).trim() : null) : item.author_name,
        project_date: body.project_date !== undefined ? (body.project_date ? String(body.project_date).trim() : null) : item.project_date,
        link_url: body.link_url !== undefined ? (body.link_url ? String(body.link_url).trim() : null) : item.link_url,
        sort_order: body.sort_order !== undefined && Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : item.sort_order,
        status: body.status !== undefined ? (body.status === '0' || body.status === 0 ? 0 : 1) : item.status,
    };
    if (file) {
        if (item.image_url) { try { await removeFile(item.image_url); } catch (_e) { /* ignore */ } }
        next.image_url = await handleUpload(file, next.title);
    }
    await item.update(next);
    return { success: 'Project updated successfully.', item };
};

const remove = async (id) => {
    const item = await projectRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Project not found.');
    if (item.image_url) { try { await removeFile(item.image_url); } catch (_e) { /* ignore */ } }
    await item.destroy();
    return { success: 'Project deleted successfully.' };
};

const toggleStatus = async (id) => {
    const item = await projectRepo.findOne({ id });
    if (!item) throw new HttpError(404, 'Project not found.');
    await item.update({ status: item.status ? 0 : 1 });
    return { success: 'Status updated', item };
};

module.exports = { list, listPublic, get, create, update, remove, toggleStatus };
