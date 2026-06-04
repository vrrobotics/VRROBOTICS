import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import ManageCard from '../../components/ManageCard';
import {
    listProjects, storeProject, updateProject, deleteProject, toggleProjectStatus, getProject,
} from '../../api/project';

/**
 * Manage Student Projects — admin CRUD for the public Home → Student Projects
 * section. Add/Edit open a modal (title, author, date, link, image, status).
 * Active items appear on the Home page via GET /api/public/projects.
 */

// Render a stored date as "AUG 18, 2024". Falls back to the raw value for
// legacy free-text dates that aren't ISO-parseable.
const fmtDate = (raw) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
};

export default function ProjectsIndex() {
    const [params, setParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const query = Object.fromEntries(params.entries());

    const load = async () => {
        setLoading(true); setError(null);
        try { setData(await listProjects({ page: query.page, search: query.search })); }
        catch (err) { setError(err?.response?.data?.error || 'Failed to load projects'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);

    useEffect(() => {
        if (query.action === 'add') { setAddOpen(true); const next = { ...query }; delete next.action; setParams(next, { replace: true }); }
        // eslint-disable-next-line
    }, []);

    const onSearch = (e) => {
        e.preventDefault();
        const term = (new FormData(e.target).get('search') || '').toString().trim();
        const next = { ...query };
        if (term) next.search = term; else delete next.search;
        delete next.page;
        setParams(next);
    };

    const handleDelete = async (id) => {
        try { await deleteProject(id); toast.success('Project deleted'); setConfirm(null); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); setConfirm(null); }
    };
    const handleToggle = async (id) => {
        try { await toggleProjectStatus(id); toast.success('Status updated'); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };
    const openEdit = async (id) => {
        try { const res = await getProject(id); setEditItem(res.item); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed to load project'); }
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-skin rounded-full animate-spin mb-3" />
                <p className="text-[14px]">Loading projects…</p>
            </div>
        );
    }
    if (error && !data) {
        return (
            <div className="ol-card rounded-ol-8"><div className="ol-card-body py-10 px-6 text-center">
                <p className="text-[16px] font-semibold text-danger mb-2">Couldn’t load projects</p>
                <p className="text-[13px] text-gray mb-4">{error}</p>
                <button className="ol-btn-primary" onClick={load}>Retry</button>
            </div></div>
        );
    }

    const rows = data.projects.data;
    const isEmpty = rows.length === 0;

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3"><div className="ol-card-body py-12px px-20px my-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h4 className="text-[16px] font-semibold text-dark m-0">Student Projects</h4>
                    <button type="button" className="ol-btn-outline-secondary flex items-center gap-10px" onClick={() => setAddOpen(true)}>
                        <span className="fi-rr-plus" /><span>Add Project</span>
                    </button>
                </div>
            </div></div>

            <div className="ol-card"><div className="ol-card-body p-3">
                <form onSubmit={onSearch} className="flex justify-end gap-3 mb-3 mt-3">
                    <input className="ol-form-control max-w-[280px]" name="search" type="text" placeholder="Search by title" defaultValue={query.search || ''} />
                    <button type="submit" className="ol-btn-primary">Search</button>
                </form>

                {isEmpty ? (
                    <div className="py-12 text-center border border-dashed border-border rounded-ol-8">
                        <p className="text-[16px] font-semibold text-dark mb-1">No projects yet</p>
                        <p className="text-[13px] text-gray">Click “Add Project” to create the first one.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-gray text-[14px] mb-3">Showing {rows.length} of {data.projects.total}{loading && <span className="ml-2 text-[12px]">Refreshing…</span>}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rows.map((p) => (
                                <ManageCard
                                    key={p.id}
                                    active={!!p.status}
                                    onEdit={() => openEdit(p.id)}
                                    onToggle={() => handleToggle(p.id)}
                                    onDelete={() => setConfirm(p.id)}
                                    cover={p.image_url
                                        ? <img src={p.image_url} alt={p.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                        : <div className="w-full h-full flex items-center justify-center text-[12px] text-gray bg-gradient-to-br from-orange-100 to-orange-50">No image</div>}
                                >
                                    <h4 className="text-[14px] font-semibold text-dark m-0 truncate">{p.title}</h4>
                                    {p.author_name && <p className="text-[12px] text-warm-green font-semibold mt-1 mb-0">by {p.author_name}</p>}
                                    {p.project_date && <p className="text-[12px] text-gray mt-0.5 mb-0">{fmtDate(p.project_date)}</p>}
                                    {p.description && <p className="text-[12px] text-gray mt-1 mb-0 line-clamp-2">{p.description}</p>}
                                </ManageCard>
                            ))}
                        </div>
                    </>
                )}
            </div></div>

            {addOpen && (
                <Modal title="Add Project" size="md" onClose={() => setAddOpen(false)}>
                    <ProjectForm submitLabel="Add project" onSubmit={async (fd) => {
                        try { await storeProject(fd); toast.success('Project created'); setAddOpen(false); load(); }
                        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
                    }} />
                </Modal>
            )}
            {editItem && (
                <Modal title="Edit Project" size="md" onClose={() => setEditItem(null)}>
                    <ProjectForm initial={editItem} submitLabel="Update project" onSubmit={async (fd) => {
                        try { await updateProject(editItem.id, fd); toast.success('Project updated'); setEditItem(null); load(); }
                        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
                    }} />
                </Modal>
            )}
            {confirm && (
                <ConfirmDialog message="Delete this project?" onCancel={() => setConfirm(null)} onConfirm={() => handleDelete(confirm)} />
            )}
        </div>
    );
}

function ProjectForm({ initial, onSubmit, submitLabel }) {
    const [form, setForm] = useState({
        title: initial?.title || '',
        author_name: initial?.author_name || '',
        project_date: initial?.project_date || '',
        link_url: initial?.link_url || '',
        description: initial?.description || '',
        sort_order: initial?.sort_order ?? 0,
        status: initial?.status === undefined ? '1' : String(initial.status),
    });
    const [file, setFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
            if (file) fd.append('image', file);
            await onSubmit(fd);
        } finally { setSubmitting(false); }
    };

    return (
        <form onSubmit={submit} encType="multipart/form-data">
            <div className="mb-3">
                <label className="ol-form-label">Title<span className="text-danger ms-1">*</span></label>
                <input className="ol-form-control" required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Laser Security Alarm System" />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                    <label className="ol-form-label">Author (student)</label>
                    <input className="ol-form-control" value={form.author_name} onChange={(e) => set('author_name', e.target.value)} placeholder="e.g. Mohith" />
                </div>
                <div>
                    <label className="ol-form-label">Date<span className="text-danger ms-1">*</span></label>
                    <input type="date" className="ol-form-control" required value={form.project_date} onChange={(e) => set('project_date', e.target.value)} />
                </div>
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Description</label>
                <textarea className="ol-form-control" rows="2" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description of the project" />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                    <label className="ol-form-label">Project link</label>
                    <input className="ol-form-control" value={form.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="Optional URL" />
                </div>
                <div>
                    <label className="ol-form-label">Sort order</label>
                    <input type="number" className="ol-form-control" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
                </div>
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Status</label>
                <select className="ol-form-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="1">Active (visible on site)</option>
                    <option value="0">Hidden</option>
                </select>
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Project image</label>
                {initial?.image_url && <div className="mb-2"><img src={initial.image_url} alt="" className="w-full h-40 object-cover rounded border border-ebordermuted" /></div>}
                <input className="ol-form-control" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
                <p className="text-[12px] text-gray mt-1">{initial ? 'Leave blank to keep the current image.' : 'Upload the project image.'}</p>
            </div>
            <div className="flex justify-end">
                <button type="submit" className="ol-btn-primary" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button>
            </div>
        </form>
    );
}
