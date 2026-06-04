import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import ManageCard from '../../components/ManageCard';
import {
    listTestimonials, storeTestimonial, updateTestimonial, deleteTestimonial, toggleTestimonialStatus, getTestimonial,
} from '../../api/testimonial';

/**
 * Manage Testimonials — admin CRUD for the public Home → Testimonials section.
 * Add/Edit open a modal (message, author, role, avatar, status). Active items
 * appear on the Home page via GET /api/public/testimonials.
 */
export default function TestimonialsIndex() {
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
        try { setData(await listTestimonials({ page: query.page, search: query.search })); }
        catch (err) { setError(err?.response?.data?.error || 'Failed to load testimonials'); }
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
        try { await deleteTestimonial(id); toast.success('Testimonial deleted'); setConfirm(null); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); setConfirm(null); }
    };
    const handleToggle = async (id) => {
        try { await toggleTestimonialStatus(id); toast.success('Status updated'); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };
    const openEdit = async (id) => {
        try { const res = await getTestimonial(id); setEditItem(res.item); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed to load testimonial'); }
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-skin rounded-full animate-spin mb-3" />
                <p className="text-[14px]">Loading testimonials…</p>
            </div>
        );
    }
    if (error && !data) {
        return (
            <div className="ol-card rounded-ol-8"><div className="ol-card-body py-10 px-6 text-center">
                <p className="text-[16px] font-semibold text-danger mb-2">Couldn’t load testimonials</p>
                <p className="text-[13px] text-gray mb-4">{error}</p>
                <button className="ol-btn-primary" onClick={load}>Retry</button>
            </div></div>
        );
    }

    const rows = data.testimonials.data;
    const isEmpty = rows.length === 0;

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3"><div className="ol-card-body py-12px px-20px my-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h4 className="text-[16px] font-semibold text-dark m-0">Testimonials</h4>
                    <button type="button" className="ol-btn-outline-secondary flex items-center gap-10px" onClick={() => setAddOpen(true)}>
                        <span className="fi-rr-plus" /><span>Add Testimonial</span>
                    </button>
                </div>
            </div></div>

            <div className="ol-card"><div className="ol-card-body p-3">
                <form onSubmit={onSearch} className="flex justify-end gap-3 mb-3 mt-3">
                    <input className="ol-form-control max-w-[280px]" name="search" type="text" placeholder="Search by author" defaultValue={query.search || ''} />
                    <button type="submit" className="ol-btn-primary">Search</button>
                </form>

                {isEmpty ? (
                    <div className="py-12 text-center border border-dashed border-border rounded-ol-8">
                        <p className="text-[16px] font-semibold text-dark mb-1">No testimonials yet</p>
                        <p className="text-[13px] text-gray">Click “Add Testimonial” to create the first one.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-gray text-[14px] mb-3">Showing {rows.length} of {data.testimonials.total}{loading && <span className="ml-2 text-[12px]">Refreshing…</span>}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rows.map((t) => (
                                <ManageCard
                                    key={t.id}
                                    active={!!t.status}
                                    onEdit={() => openEdit(t.id)}
                                    onToggle={() => handleToggle(t.id)}
                                    onDelete={() => setConfirm(t.id)}
                                    cover={
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 via-orange-50 to-white">
                                            <img
                                                src={t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author_name)}&background=FF6A00&color=fff`}
                                                alt={t.author_name}
                                                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                                            />
                                        </div>
                                    }
                                >
                                    <h4 className="text-[14px] font-semibold text-dark m-0">{t.author_name}</h4>
                                    {t.role && <p className="text-[11px] text-warm-green font-semibold m-0">{t.role}</p>}
                                    <p className="text-[12px] text-gray line-clamp-3 mt-1.5 mb-0">“{t.message}”</p>
                                </ManageCard>
                            ))}
                        </div>
                    </>
                )}
            </div></div>

            {addOpen && (
                <Modal title="Add Testimonial" size="md" onClose={() => setAddOpen(false)}>
                    <TestimonialForm submitLabel="Add testimonial" onSubmit={async (fd) => {
                        try { await storeTestimonial(fd); toast.success('Testimonial created'); setAddOpen(false); load(); }
                        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
                    }} />
                </Modal>
            )}
            {editItem && (
                <Modal title="Edit Testimonial" size="md" onClose={() => setEditItem(null)}>
                    <TestimonialForm initial={editItem} submitLabel="Update testimonial" onSubmit={async (fd) => {
                        try { await updateTestimonial(editItem.id, fd); toast.success('Testimonial updated'); setEditItem(null); load(); }
                        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
                    }} />
                </Modal>
            )}
            {confirm && (
                <ConfirmDialog message="Delete this testimonial?" onCancel={() => setConfirm(null)} onConfirm={() => handleDelete(confirm)} />
            )}
        </div>
    );
}

function TestimonialForm({ initial, onSubmit, submitLabel }) {
    const [form, setForm] = useState({
        author_name: initial?.author_name || '',
        role: initial?.role || '',
        message: initial?.message || '',
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
            if (file) fd.append('avatar', file);
            await onSubmit(fd);
        } finally { setSubmitting(false); }
    };

    return (
        <form onSubmit={submit} encType="multipart/form-data">
            <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                    <label className="ol-form-label">Author name<span className="text-danger ms-1">*</span></label>
                    <input className="ol-form-control" required value={form.author_name} onChange={(e) => set('author_name', e.target.value)} placeholder="e.g. Devshree" />
                </div>
                <div>
                    <label className="ol-form-label">Role</label>
                    <input className="ol-form-control" value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Student, Grade 6" />
                </div>
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Message<span className="text-danger ms-1">*</span></label>
                <textarea className="ol-form-control" rows="4" required value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="The testimonial quote" />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                    <label className="ol-form-label">Sort order</label>
                    <input type="number" className="ol-form-control" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
                </div>
                <div>
                    <label className="ol-form-label">Status</label>
                    <select className="ol-form-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
                        <option value="1">Active (visible on site)</option>
                        <option value="0">Hidden</option>
                    </select>
                </div>
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Avatar (optional)</label>
                {initial?.avatar_url && <div className="mb-2"><img src={initial.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border border-ebordermuted" /></div>}
                <input className="ol-form-control" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
                <p className="text-[12px] text-gray mt-1">{initial ? 'Leave blank to keep the current avatar.' : 'Optional — a default initials avatar is used if omitted.'}</p>
            </div>
            <div className="flex justify-end">
                <button type="submit" className="ol-btn-primary" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button>
            </div>
        </form>
    );
}
