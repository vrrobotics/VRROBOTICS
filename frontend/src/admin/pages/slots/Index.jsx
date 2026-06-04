import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import {
    listSlots, storeSlot, updateSlot, deleteSlot, toggleSlotStatus, getSlot, listCourseStudents,
} from '../../api/slot';
import { listCourses } from '../../api/course';
import { listTeachers } from '../../api/teacher';
import { listStudents } from '../../api/student';

/**
 * Manage Slots — admin scheduling. A slot ties a course to a time window and a
 * set of teachers + students. Add/Edit open a modal; ?action=add (from the
 * "Add Slot" sidebar link) auto-opens the Add modal. Course/teacher/student
 * dropdowns are populated from the existing admin endpoints.
 */

const fmt = (raw) => {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

// <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` in local time.
const toLocalInput = (raw) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function SlotsIndex() {
    const [params, setParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [confirm, setConfirm] = useState(null);

    // Dropdown sources, loaded once.
    const [courses, setCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);

    const query = Object.fromEntries(params.entries());

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await listSlots({ page: query.page, search: query.search }));
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load slots');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);

    // Load courses / teachers / students for the form dropdowns.
    useEffect(() => {
        (async () => {
            try {
                const c = await listCourses({ status: 'all', per_page: 1000 });
                setCourses((c?.courses?.data || []).map((x) => ({
                    value: String(x.id),
                    label: x.title || x.name || `Course #${x.id}`,
                })));
            } catch { /* leave empty */ }
            try {
                const t = await listTeachers({ per_page: 1000 });
                setTeachers((t?.teachers || []).map((x) => ({
                    value: String(x.id ?? x.userId),
                    label: x.name || x.email || `Teacher ${x.id ?? x.userId}`,
                    sub: x.email,
                })));
            } catch { /* leave empty */ }
            try {
                const s = await listStudents({ per_page: 1000 });
                setStudents((s?.students || []).map((x) => ({
                    value: String(x.id),
                    label: x.name || x.email || `Student ${x.id}`,
                    sub: x.email,
                })));
            } catch { /* leave empty */ }
        })();
    }, []);

    // Deep-link from the "Add Slot" sidebar item opens the Add modal once.
    useEffect(() => {
        if (query.action === 'add') {
            setAddOpen(true);
            const next = { ...query };
            delete next.action;
            setParams(next, { replace: true });
        }
        // eslint-disable-next-line
    }, []);

    const courseName = useMemo(() => {
        const m = new Map(courses.map((c) => [c.value, c.label]));
        return (id) => (id == null ? '—' : (m.get(String(id)) || `Course #${id}`));
    }, [courses]);
    const nameLookup = (opts) => {
        const m = new Map(opts.map((o) => [o.value, o.label]));
        return (ids) => (Array.isArray(ids) ? ids : []).map((id) => m.get(String(id)) || String(id));
    };
    const teacherNames = useMemo(() => nameLookup(teachers), [teachers]);
    const studentNames = useMemo(() => nameLookup(students), [students]);

    const onSearch = (e) => {
        e.preventDefault();
        const term = (new FormData(e.target).get('search') || '').toString().trim();
        const next = { ...query };
        if (term) next.search = term; else delete next.search;
        delete next.page;
        setParams(next);
    };

    const handleDelete = async (id) => {
        try {
            await deleteSlot(id);
            toast.success('Slot deleted');
            setConfirm(null);
            load();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed');
            setConfirm(null);
        }
    };

    const handleToggle = async (id) => {
        try {
            await toggleSlotStatus(id);
            toast.success('Status updated');
            load();
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed');
        }
    };

    const openEdit = async (id) => {
        try {
            const res = await getSlot(id);
            setEditItem(res.item);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to load slot');
        }
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-skin rounded-full animate-spin mb-3" />
                <p className="text-[14px]">Loading slots…</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="ol-card rounded-ol-8">
                <div className="ol-card-body py-10 px-6 text-center">
                    <p className="text-[16px] font-semibold text-danger mb-2">Couldn’t load slots</p>
                    <p className="text-[13px] text-gray mb-4">{error}</p>
                    <button className="ol-btn-primary" onClick={load}>Retry</button>
                </div>
            </div>
        );
    }

    const rows = data.slots.data;
    const isEmpty = rows.length === 0;
    const formProps = { courses, teachers, students };

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3">
                <div className="ol-card-body py-12px px-20px my-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h4 className="text-[16px] font-semibold text-dark m-0">Slots</h4>
                        <button
                            type="button"
                            className="ol-btn-outline-secondary flex items-center gap-10px"
                            onClick={() => setAddOpen(true)}
                        >
                            <span className="fi-rr-plus" />
                            <span>Add Slot</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="ol-card">
                <div className="ol-card-body p-3">
                    <form onSubmit={onSearch} className="flex justify-end gap-3 mb-3 mt-3">
                        <input
                            className="ol-form-control max-w-[280px]"
                            name="search"
                            type="text"
                            placeholder="Search by slot name"
                            defaultValue={query.search || ''}
                        />
                        <button type="submit" className="ol-btn-primary">Search</button>
                    </form>

                    {isEmpty ? (
                        <div className="py-12 text-center border border-dashed border-border rounded-ol-8">
                            <p className="text-[16px] font-semibold text-dark mb-1">No slots yet</p>
                            <p className="text-[13px] text-gray">Click “Add Slot” to create the first one.</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-gray text-[14px] mb-3">
                                Showing {rows.length} of {data.slots.total}
                                {loading && <span className="ml-2 text-[12px]">Refreshing…</span>}
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead>
                                        <tr className="text-left text-gray border-b border-ebordermuted">
                                            <th className="py-2 pr-3 font-semibold">Slot</th>
                                            <th className="py-2 pr-3 font-semibold">Course</th>
                                            <th className="py-2 pr-3 font-semibold">Timeline</th>
                                            <th className="py-2 pr-3 font-semibold">Teachers</th>
                                            <th className="py-2 pr-3 font-semibold">Students</th>
                                            <th className="py-2 pr-3 font-semibold">Link</th>
                                            <th className="py-2 pr-3 font-semibold">Status</th>
                                            <th className="py-2 pr-3 font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((s) => {
                                            const tNames = teacherNames(s.teacher_ids);
                                            const sNames = studentNames(s.student_ids);
                                            return (
                                                <tr key={s.id} className="border-b border-ebordermuted align-top">
                                                    <td className="py-3 pr-3 font-semibold text-dark">{s.name}</td>
                                                    <td className="py-3 pr-3">{courseName(s.course_id)}</td>
                                                    <td className="py-3 pr-3 whitespace-nowrap">{fmt(s.start_at)}<br />→ {fmt(s.end_at)}</td>
                                                    <td className="py-3 pr-3" title={tNames.join(', ')}>
                                                        {tNames.length ? `${tNames.length}: ${tNames.slice(0, 2).join(', ')}${tNames.length > 2 ? '…' : ''}` : '—'}
                                                    </td>
                                                    <td className="py-3 pr-3" title={sNames.join(', ')}>
                                                        {sNames.length ? `${sNames.length}: ${sNames.slice(0, 2).join(', ')}${sNames.length > 2 ? '…' : ''}` : '—'}
                                                    </td>
                                                    <td className="py-3 pr-3">
                                                        {s.meeting_link ? <a href={s.meeting_link} target="_blank" rel="noopener noreferrer" className="text-skin underline">Join</a> : '—'}
                                                    </td>
                                                    <td className="py-3 pr-3">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                            s.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {s.status ? 'Active' : 'Hidden'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 pr-3">
                                                        <div className="flex gap-2">
                                                            <button className="ol-btn-light text-[12px] px-3 py-1" onClick={() => openEdit(s.id)}>Edit</button>
                                                            <button className="ol-btn-outline-secondary text-[12px] px-3 py-1" onClick={() => handleToggle(s.id)}>
                                                                {s.status ? 'Hide' : 'Show'}
                                                            </button>
                                                            <button className="ol-btn-danger text-[12px] px-3 py-1" onClick={() => setConfirm(s.id)}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {data.slots.last_page > 1 && (
                                <nav className="mt-4">
                                    <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
                                        {Array.from({ length: data.slots.last_page }, (_, i) => i + 1).map((p) => (
                                            <li key={p}>
                                                <button
                                                    className={`e-page-link ${p === data.slots.current_page ? 'e-page-link-active' : ''}`}
                                                    onClick={() => setParams({ ...query, page: p })}
                                                >
                                                    {p}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </nav>
                            )}
                        </>
                    )}
                </div>
            </div>

            {addOpen && (
                <Modal title="Add Slot" size="lg" onClose={() => setAddOpen(false)}>
                    <SlotForm
                        {...formProps}
                        submitLabel="Add slot"
                        onSubmit={async (body) => {
                            try {
                                await storeSlot(body);
                                toast.success('Slot created');
                                setAddOpen(false);
                                load();
                            } catch (e) {
                                toast.error(e.response?.data?.error || 'Failed');
                            }
                        }}
                    />
                </Modal>
            )}

            {editItem && (
                <Modal title="Edit Slot" size="lg" onClose={() => setEditItem(null)}>
                    <SlotForm
                        {...formProps}
                        initial={editItem}
                        submitLabel="Update slot"
                        onSubmit={async (body) => {
                            try {
                                await updateSlot(editItem.id, body);
                                toast.success('Slot updated');
                                setEditItem(null);
                                load();
                            } catch (e) {
                                toast.error(e.response?.data?.error || 'Failed');
                            }
                        }}
                    />
                </Modal>
            )}

            {confirm && (
                <ConfirmDialog
                    message="Delete this slot?"
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => handleDelete(confirm)}
                />
            )}
        </div>
    );
}

// Searchable checkbox multi-select. Keeps the chosen ids in `selected`.
function MultiSelect({ label, options, selected, onChange, emptyHint }) {
    const [term, setTerm] = useState('');
    const sel = new Set((selected || []).map(String));
    const filtered = term
        ? options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(term.toLowerCase()))
        : options;
    const toggle = (val) => {
        const next = new Set(sel);
        if (next.has(val)) next.delete(val); else next.add(val);
        onChange([...next]);
    };
    return (
        <div>
            <label className="ol-form-label flex items-center justify-between">
                <span>{label}</span>
                <span className="text-[11px] text-gray font-normal">{sel.size} selected</span>
            </label>
            <input
                className="ol-form-control mb-2"
                placeholder={`Search ${label.toLowerCase()}…`}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
            />
            <div className="max-h-44 overflow-y-auto border border-ebordermuted rounded-ol-8 p-2">
                {options.length === 0 ? (
                    <p className="text-[12px] text-gray px-1 py-2">{emptyHint || 'None available.'}</p>
                ) : filtered.length === 0 ? (
                    <p className="text-[12px] text-gray px-1 py-2">No matches.</p>
                ) : (
                    filtered.map((o) => (
                        <label key={o.value} className="flex items-center gap-2 px-1 py-1 text-[13px] cursor-pointer hover:bg-lightgreen rounded">
                            <input type="checkbox" checked={sel.has(o.value)} onChange={() => toggle(o.value)} />
                            <span className="text-dark">{o.label}</span>
                            {o.sub && <span className="text-gray text-[11px] truncate">· {o.sub}</span>}
                        </label>
                    ))
                )}
            </div>
        </div>
    );
}

function SlotForm({ initial, onSubmit, submitLabel, courses, teachers }) {
    const [form, setForm] = useState({
        name: initial?.name || '',
        course_id: initial?.course_id != null ? String(initial.course_id) : '',
        start_at: toLocalInput(initial?.start_at),
        end_at: toLocalInput(initial?.end_at),
        teacher_ids: (initial?.teacher_ids || []).map(String),
        student_ids: (initial?.student_ids || []).map(String),
        meeting_link: initial?.meeting_link || '',
        status: initial?.status === undefined ? '1' : String(initial.status),
    });
    const [submitting, setSubmitting] = useState(false);
    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

    // Students shown in the picker are driven by the selected course — only
    // students enrolled in that course appear. Reloads whenever course changes.
    const [courseStudents, setCourseStudents] = useState([]);
    const [studentsLoading, setStudentsLoading] = useState(false);
    useEffect(() => {
        if (!form.course_id) { setCourseStudents([]); return; }
        let alive = true;
        setStudentsLoading(true);
        listCourseStudents(form.course_id)
            .then((r) => {
                if (!alive) return;
                setCourseStudents((r?.students || []).map((x) => ({
                    value: String(x.id), label: x.name || x.email || `Student ${x.id}`, sub: x.email,
                })));
            })
            .catch(() => { if (alive) setCourseStudents([]); })
            .finally(() => { if (alive) setStudentsLoading(false); });
        return () => { alive = false; };
    }, [form.course_id]);

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await onSubmit({
                name: form.name,
                course_id: form.course_id || null,
                // datetime-local has no timezone; convert to ISO for the API.
                start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
                end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
                teacher_ids: form.teacher_ids,
                student_ids: form.student_ids,
                meeting_link: form.meeting_link || null,
                status: form.status,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={submit}>
            <div className="mb-3">
                <label className="ol-form-label">Slot name<span className="text-danger ms-1">*</span></label>
                <input className="ol-form-control" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Morning Robotics Batch A" />
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Course</label>
                <select className="ol-form-control" value={form.course_id} onChange={(e) => set('course_id', e.target.value)}>
                    <option value="">— Select a course —</option>
                    {courses.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {courses.length === 0 && <p className="text-[12px] text-gray mt-1">No courses found.</p>}
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                    <label className="ol-form-label">Start</label>
                    <input type="datetime-local" className="ol-form-control" value={form.start_at} onChange={(e) => set('start_at', e.target.value)} />
                </div>
                <div>
                    <label className="ol-form-label">End</label>
                    <input type="datetime-local" className="ol-form-control" value={form.end_at} onChange={(e) => set('end_at', e.target.value)} />
                </div>
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Meeting link</label>
                <input className="ol-form-control" value={form.meeting_link} onChange={(e) => set('meeting_link', e.target.value)} placeholder="https://meet.google.com/…" />
            </div>
            <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <MultiSelect
                    label="Teachers"
                    options={teachers}
                    selected={form.teacher_ids}
                    onChange={(v) => set('teacher_ids', v)}
                    emptyHint="No teachers found."
                />
                <MultiSelect
                    label="Students"
                    options={courseStudents}
                    selected={form.student_ids}
                    onChange={(v) => set('student_ids', v)}
                    emptyHint={
                        !form.course_id
                            ? 'Select a course first to load its students.'
                            : studentsLoading
                                ? 'Loading students…'
                                : 'No students enrolled in this course.'
                    }
                />
            </div>
            <div className="mb-3">
                <label className="ol-form-label">Status</label>
                <select className="ol-form-control" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="1">Active</option>
                    <option value="0">Hidden</option>
                </select>
            </div>
            <div className="flex justify-end">
                <button type="submit" className="ol-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : submitLabel}
                </button>
            </div>
        </form>
    );
}
