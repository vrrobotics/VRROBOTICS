import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FileText, Trash2 } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import { MultiSelect } from '../../components/scheduling';
import {
    listResources, storeResource, updateResource, deleteResource, toggleResourceStatus, getResource,
} from '../../api/resource';
import { listTeachers } from '../../api/teacher';
import { listResourceCategories } from '../../api/resourceCategory';
import { listCourses } from '../../api/course';

/**
 * Manage Resources — admin uploads PDF resources (title + one-or-more PDFs →
 * Cloudflare R2) and assigns them to teacher(s). Assigned teachers see them on
 * their dashboard Resources tab. Independent of course creation.
 */
export default function ResourcesIndex() {
    const [params, setParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [courses, setCourses] = useState([]);

    const query = Object.fromEntries(params.entries());

    const load = async () => {
        setLoading(true); setError(null);
        try { setData(await listResources({ page: query.page, search: query.search })); }
        catch (err) { setError(err?.response?.data?.error || 'Failed to load resources'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);

    useEffect(() => {
        (async () => {
            try {
                const t = await listTeachers({ per_page: 1000 });
                setTeachers((t?.teachers || []).map((x) => ({ value: String(x.id ?? x.userId), label: x.name || x.email || `Teacher ${x.id ?? x.userId}`, sub: x.email })));
            } catch { /* */ }
            try {
                const c = await listResourceCategories();
                setCategories(c?.categories || []);
            } catch { /* */ }
            try {
                const r = await listCourses({ per_page: 1000 });
                setCourses(r?.courses?.data || r?.courses || []);
            } catch { /* */ }
        })();
    }, []);

    useEffect(() => {
        if (query.action === 'add') { setAddOpen(true); const next = { ...query }; delete next.action; setParams(next, { replace: true }); }
        // eslint-disable-next-line
    }, []);

    const teacherNames = useMemo(() => {
        const m = new Map(teachers.map((o) => [o.value, o.label]));
        return (ids) => (Array.isArray(ids) ? ids : []).map((id) => m.get(String(id)) || String(id));
    }, [teachers]);

    const catName = (id) => categories.find((c) => String(c.id) === String(id))?.name || null;

    const onSearch = (e) => {
        e.preventDefault();
        const term = (new FormData(e.target).get('search') || '').toString().trim();
        const next = { ...query };
        if (term) next.search = term; else delete next.search;
        delete next.page;
        setParams(next);
    };

    const handleDelete = async (id) => {
        try { await deleteResource(id); toast.success('Resource deleted'); setConfirm(null); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); setConfirm(null); }
    };
    const handleToggle = async (id) => {
        try { await toggleResourceStatus(id); toast.success('Status updated'); load(); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };
    const openEdit = async (id) => {
        try { const res = await getResource(id); setEditItem(res.item); }
        catch (e) { toast.error(e.response?.data?.error || 'Failed to load resource'); }
    };

    if (loading && !data) {
        return <div className="flex flex-col items-center justify-center py-20 text-gray"><div className="w-10 h-10 border-4 border-gray-200 border-t-skin rounded-full animate-spin mb-3" /><p className="text-[14px]">Loading resources…</p></div>;
    }
    if (error && !data) {
        return <div className="ol-card rounded-ol-8"><div className="ol-card-body py-10 px-6 text-center"><p className="text-[16px] font-semibold text-danger mb-2">Couldn’t load resources</p><p className="text-[13px] text-gray mb-4">{error}</p><button className="ol-btn-primary" onClick={load}>Retry</button></div></div>;
    }

    const rows = data.resources.data;
    const isEmpty = rows.length === 0;

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3"><div className="ol-card-body py-12px px-20px my-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h4 className="text-[16px] font-semibold text-dark m-0">Resources</h4>
                    <button type="button" className="ol-btn-outline-secondary flex items-center gap-10px" onClick={() => setAddOpen(true)}>
                        <span className="fi-rr-plus" /><span>Add Resource</span>
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
                        <p className="text-[16px] font-semibold text-dark mb-1">No resources yet</p>
                        <p className="text-[13px] text-gray">Click “Add Resource” to upload PDFs and assign them to teachers.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-gray text-[14px] mb-3">Showing {rows.length} of {data.resources.total}{loading && <span className="ml-2 text-[12px]">Refreshing…</span>}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rows.map((r) => {
                                const tN = teacherNames(r.teacher_ids);
                                return (
                                    <div key={r.id} className="border border-ebordermuted rounded-ol-12 bg-white p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="text-[14px] font-semibold text-dark m-0">{r.title}</h4>
                                            <span className={`shrink-0 inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${r.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.status ? 'Active' : 'Hidden'}</span>
                                        </div>
                                        {r.description && <p className="text-[12px] text-gray mt-1 mb-0 line-clamp-2">{r.description}</p>}
                                        {(catName(r.resource_category_id) || r.section) && (
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {catName(r.resource_category_id) && <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700">{catName(r.resource_category_id)}</span>}
                                                {r.section && <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700">{r.section}</span>}
                                            </div>
                                        )}
                                        <div className="mt-2 space-y-1">
                                            {(r.files || []).map((f, i) => (
                                                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] text-skin hover:underline truncate">
                                                    <FileText className="w-3.5 h-3.5 shrink-0" /> {f.name}
                                                </a>
                                            ))}
                                            {(r.files || []).length === 0 && <p className="text-[11px] text-gray m-0">No files</p>}
                                        </div>
                                        <p className="text-[11px] text-gray mt-2 mb-0" title={tN.join(', ')}>
                                            Teachers: {tN.length ? `${tN.slice(0, 2).join(', ')}${tN.length > 2 ? ` +${tN.length - 2}` : ''}` : '—'}
                                        </p>
                                        <div className="flex gap-2 mt-3">
                                            <button className="ol-btn-light text-[12px] px-3 py-1" onClick={() => openEdit(r.id)}>Edit</button>
                                            <button className="ol-btn-outline-secondary text-[12px] px-3 py-1" onClick={() => handleToggle(r.id)}>{r.status ? 'Hide' : 'Show'}</button>
                                            <button className="ol-btn-danger text-[12px] px-3 py-1" onClick={() => setConfirm(r.id)}>Delete</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div></div>

            {addOpen && (
                <Modal title="Add Resource" size="md" onClose={() => setAddOpen(false)}>
                    <ResourceForm teachers={teachers} categories={categories} courses={courses} submitLabel="Add resource" onSubmit={async (fd) => {
                        try { await storeResource(fd); toast.success('Resource created'); setAddOpen(false); load(); }
                        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
                    }} />
                </Modal>
            )}
            {editItem && (
                <Modal title="Edit Resource" size="md" onClose={() => setEditItem(null)}>
                    <ResourceForm teachers={teachers} categories={categories} courses={courses} initial={editItem} submitLabel="Update resource" onSubmit={async (fd) => {
                        try { await updateResource(editItem.id, fd); toast.success('Resource updated'); setEditItem(null); load(); }
                        catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
                    }} />
                </Modal>
            )}
            {confirm && <ConfirmDialog message="Delete this resource (and its PDFs)?" onCancel={() => setConfirm(null)} onConfirm={() => handleDelete(confirm)} />}
        </div>
    );
}

function ResourceForm({ initial, onSubmit, submitLabel, teachers, categories = [], courses = [] }) {
    const [form, setForm] = useState({
        title: initial?.title || '',
        description: initial?.description || '',
        teacher_ids: (initial?.teacher_ids || []).map(String),
        resource_category_id: initial?.resource_category_id ? String(initial.resource_category_id) : '',
        course_id: initial?.course_id ? String(initial.course_id) : '',
        section: initial?.section || '',
        status: initial?.status === undefined ? '1' : String(initial.status),
    });
    const [files, setFiles] = useState([]);              // newly added PDFs
    const [removeUrls, setRemoveUrls] = useState([]);    // existing files to drop
    const [submitting, setSubmitting] = useState(false);
    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
    const existing = (initial?.files || []).filter((f) => !removeUrls.includes(f.url));

    const submit = async (e) => {
        e.preventDefault();
        if (!initial && files.length === 0) { toast.error('Add at least one PDF'); return; }
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('title', form.title);
            fd.append('description', form.description ?? '');
            fd.append('teacher_ids', JSON.stringify(form.teacher_ids));
            fd.append('resource_category_id', form.resource_category_id || '');
            fd.append('course_id', form.course_id || '');
            fd.append('section', form.section ?? '');
            fd.append('status', form.status);
            if (removeUrls.length) fd.append('remove_urls', JSON.stringify(removeUrls));
            files.forEach((f) => fd.append('files', f));
            await onSubmit(fd);
        } finally { setSubmitting(false); }
    };

    return (
        <form onSubmit={submit} encType="multipart/form-data">
            <div className="mb-3">
                <label className="ol-form-label">Title<span className="text-danger ms-1">*</span></label>
                <input className="ol-form-control" required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Arduino Basics — Worksheets" />
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Description</label>
                <textarea className="ol-form-control" rows="2" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional note about these PDFs" />
            </div>

            {/* Course dropdown intentionally removed from the UI per request.
                The course_id form state + submit append are kept so the
                backend logic stays intact (it just submits empty for now). */}
            <div className="mb-3">
                <label className="ol-form-label">Category</label>
                <select className="ol-form-control" value={form.resource_category_id} onChange={(e) => set('resource_category_id', e.target.value)}>
                    <option value="">Select category</option>
                    {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                </select>
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Section</label>
                <input className="ol-form-control" value={form.section} onChange={(e) => set('section', e.target.value)} placeholder="e.g. Lesson Plans, Visual Aids" list="resource-section-suggestions" />
                <datalist id="resource-section-suggestions">
                    <option value="Lesson Plans" />
                    <option value="Visual Aids" />
                </datalist>
                <p className="text-[12px] text-gray mt-1">Cards are grouped under this section on the teacher dashboard.</p>
            </div>

            {/* Existing files (edit) with remove toggles */}
            {initial && (initial.files || []).length > 0 && (
                <div className="mb-3">
                    <label className="ol-form-label">Current PDFs</label>
                    <div className="space-y-1">
                        {(initial.files || []).map((f, i) => {
                            const removed = removeUrls.includes(f.url);
                            return (
                                <div key={i} className={`flex items-center justify-between gap-2 text-[12px] px-2 py-1 rounded border border-ebordermuted ${removed ? 'opacity-50 line-through' : ''}`}>
                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-skin truncate"><FileText className="w-3.5 h-3.5 shrink-0" />{f.name}</a>
                                    <button type="button" className="text-danger shrink-0" title={removed ? 'Undo' : 'Remove'}
                                        onClick={() => setRemoveUrls((cur) => removed ? cur.filter((u) => u !== f.url) : [...cur, f.url])}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mb-3">
                <label className="ol-form-label">{initial ? 'Add more PDFs' : 'PDF files'}{!initial && <span className="text-danger ms-1">*</span>}</label>
                <input className="ol-form-control" type="file" accept="application/pdf,.pdf" multiple onChange={(e) => setFiles([...e.target.files])} />
                {files.length > 0 && <p className="text-[12px] text-gray mt-1">{files.length} file(s) selected: {files.map((f) => f.name).join(', ')}</p>}
                <p className="text-[12px] text-gray mt-1">PDFs only. Uploaded to Cloudflare R2.</p>
            </div>

            <div className="mb-3">
                <MultiSelect label="Assign to teachers" options={teachers} selected={form.teacher_ids} onChange={(v) => set('teacher_ids', v)} emptyHint="No teachers found." />
            </div>

            <div className="mb-3">
                <label className="ol-form-label">Status</label>
                <select className="ol-form-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="1">Active (visible to teachers)</option>
                    <option value="0">Hidden</option>
                </select>
            </div>
            <div className="flex justify-end">
                <button type="submit" className="ol-btn-primary" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button>
            </div>
        </form>
    );
}
