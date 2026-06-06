import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import {
    listTimetable, storeTimetableEntry, updateTimetableEntry,
    deleteTimetableEntry, toggleTimetableStatus, getTimetableEntry,
} from '../../api/timetable';
import { listCourses } from '../../api/course';
import { listTeachers } from '../../api/teacher';
import { DAYS } from '../../components/scheduling';
import { listAssignments } from '../../api/teaching';

// "HH:MM" (24h) -> "h:MM AM/PM" for display.
const to12h = (hhmm) => {
    if (!hhmm) return '—';
    const [hRaw, mRaw] = String(hhmm).split(':');
    const h = Number(hRaw);
    if (Number.isNaN(h)) return hhmm;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(mRaw ?? '00').padStart(2, '0')} ${ampm}`;
};

/**
 * Manage Time table — admin CRUD for weekly-recurring entries (day + start/end
 * time + course + teacher). ?action=add auto-opens Add.
 */
export default function TimetableIndex() {
    const [params, setParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [courses, setCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);

    const query = Object.fromEntries(params.entries());

    const load = async () => {
        setLoading(true); setError(null);
        try { setData(await listTimetable({ page: query.page })); }
        catch (err) { setError(err?.response?.data?.error || 'Failed to load timetable'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);

    useEffect(() => {
        (async () => {
            try { const c = await listCourses({ status: 'all', per_page: 1000 }); setCourses((c?.courses?.data || []).map((x) => ({ value: String(x.id), label: x.title || x.name || `Course #${x.id}` }))); } catch { /* */ }
            try { const t = await listTeachers({ per_page: 1000 }); setTeachers((t?.teachers || []).map((x) => ({ value: String(x.id ?? x.userId), label: x.name || x.email || `Teacher ${x.id ?? x.userId}` }))); } catch { /* */ }
        })();
    }, []);

    useEffect(() => {
        if (query.action === 'add') { setAddOpen(true); const next = { ...query }; delete next.action; setParams(next, { replace: true }); }
        // eslint-disable-next-line
    }, []);

    const courseName = useMemo(() => { const m = new Map(courses.map((c) => [c.value, c.label])); return (id) => (id == null ? '—' : (m.get(String(id)) || `Course #${id}`)); }, [courses]);
    const teacherName = useMemo(() => { const m = new Map(teachers.map((o) => [o.value, o.label])); return (id) => (id == null ? '—' : (m.get(String(id)) || String(id))); }, [teachers]);

    const handleDelete = async (id) => { try { await deleteTimetableEntry(id); toast.success('Entry deleted'); setConfirm(null); load(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); setConfirm(null); } };
    const handleToggle = async (id) => { try { await toggleTimetableStatus(id); toast.success('Status updated'); load(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); } };
    const openEdit = async (id) => { try { const res = await getTimetableEntry(id); setEditItem(res.item); } catch (e) { toast.error(e.response?.data?.error || 'Failed to load entry'); } };

    if (loading && !data) return <div className="flex flex-col items-center justify-center py-20 text-gray"><div className="w-10 h-10 border-4 border-gray-200 border-t-skin rounded-full animate-spin mb-3" /><p className="text-[14px]">Loading time table…</p></div>;
    if (error && !data) return <div className="ol-card rounded-ol-8"><div className="ol-card-body py-10 px-6 text-center"><p className="text-[16px] font-semibold text-danger mb-2">Couldn’t load time table</p><p className="text-[13px] text-gray mb-4">{error}</p><button className="ol-btn-primary" onClick={load}>Retry</button></div></div>;

    const rows = data.entries.data;
    const isEmpty = rows.length === 0;
    const formProps = { courses, teachers };

    return (
        <div>
            <div className="ol-card rounded-ol-8 mb-3"><div className="ol-card-body py-12px px-20px my-3"><div className="flex items-center justify-between flex-wrap gap-3"><h4 className="text-[16px] font-semibold text-dark m-0">Time table</h4><button type="button" className="ol-btn-outline-secondary flex items-center gap-10px" onClick={() => setAddOpen(true)}><span className="fi-rr-plus" /><span>Add Entry</span></button></div></div></div>

            <div className="ol-card"><div className="ol-card-body p-3">
                {isEmpty ? (
                    <div className="py-12 text-center border border-dashed border-border rounded-ol-8"><p className="text-[16px] font-semibold text-dark mb-1">No timetable entries yet</p><p className="text-[13px] text-gray">Click “Add Entry” to create the first one.</p></div>
                ) : (
                    <>
                        <p className="text-gray text-[14px] mb-3">Showing {rows.length} of {data.entries.total}{loading && <span className="ml-2 text-[12px]">Refreshing…</span>}</p>
                        <div className="overflow-x-auto"><table className="w-full text-[13px]">
                            <thead><tr className="text-left text-gray border-b border-ebordermuted"><th className="py-2 pr-3 font-semibold">Day</th><th className="py-2 pr-3 font-semibold">Time</th><th className="py-2 pr-3 font-semibold">Course</th><th className="py-2 pr-3 font-semibold">Teacher</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 font-semibold">Actions</th></tr></thead>
                            <tbody>{rows.map((e) => (
                                <tr key={e.id} className="border-b border-ebordermuted">
                                    <td className="py-3 pr-3 font-semibold text-dark">{DAYS[e.day_of_week] || '—'}</td>
                                    <td className="py-3 pr-3 whitespace-nowrap">{to12h(e.start_time)} – {to12h(e.end_time)}</td>
                                    <td className="py-3 pr-3">{courseName(e.course_id)}</td>
                                    <td className="py-3 pr-3">{teacherName(e.teacher_id)}</td>
                                    <td className="py-3 pr-3"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${e.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{e.status ? 'Active' : 'Hidden'}</span></td>
                                    <td className="py-3 pr-3"><div className="flex gap-2"><button className="ol-btn-light text-[12px] px-3 py-1" onClick={() => openEdit(e.id)}>Edit</button><button className="ol-btn-outline-secondary text-[12px] px-3 py-1" onClick={() => handleToggle(e.id)}>{e.status ? 'Hide' : 'Show'}</button><button className="ol-btn-danger text-[12px] px-3 py-1" onClick={() => setConfirm(e.id)}>Delete</button></div></td>
                                </tr>))}</tbody>
                        </table></div>
                    </>
                )}
            </div></div>

            {addOpen && (<Modal title="Add Timetable Entry" size="md" onClose={() => setAddOpen(false)}><EntryForm {...formProps} submitLabel="Add entry" onSubmit={async (body) => { try { await storeTimetableEntry(body); toast.success('Entry created'); setAddOpen(false); load(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); } }} /></Modal>)}
            {editItem && (<Modal title="Edit Timetable Entry" size="md" onClose={() => setEditItem(null)}><EntryForm {...formProps} initial={editItem} submitLabel="Update entry" onSubmit={async (body) => { try { await updateTimetableEntry(editItem.id, body); toast.success('Entry updated'); setEditItem(null); load(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); } }} /></Modal>)}
            {confirm && (<ConfirmDialog message="Delete this timetable entry?" onCancel={() => setConfirm(null)} onConfirm={() => handleDelete(confirm)} />)}
        </div>
    );
}

function EntryForm({ initial, onSubmit, submitLabel, courses, teachers }) {
    const [form, setForm] = useState({
        day_of_week: initial?.day_of_week != null ? String(initial.day_of_week) : '0',
        start_time: initial?.start_time || '',
        end_time: initial?.end_time || '',
        course_id: initial?.course_id != null ? String(initial.course_id) : '',
        teacher_id: initial?.teacher_id != null ? String(initial.teacher_id) : '',
        status: initial?.status === undefined ? '1' : String(initial.status),
    });
    const [submitting, setSubmitting] = useState(false);
    const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

    // Teachers assigned (via Teacher Assignments) to the selected course. null
    // until a course is chosen; [] means none assigned. Changing the course
    // clears the picked teacher so you can only pick an assigned one.
    const [courseTeachers, setCourseTeachers] = useState(null);
    const [ctLoading, setCtLoading] = useState(false);
    const onCourseChange = (v) => setForm((s) => ({ ...s, course_id: v, teacher_id: '' }));

    useEffect(() => {
        let alive = true;
        if (!form.course_id) { setCourseTeachers(null); return undefined; }
        setCtLoading(true);
        listAssignments(form.course_id)
            .then((r) => {
                if (!alive) return;
                const seen = new Map();
                (r?.assignments || []).forEach((a) => {
                    // a.teacher may be a string name OR an object {id,name,email,phone}.
                    const t = a.teacher;
                    const id = String(a.teacher_id ?? (t && t.id) ?? '');
                    const label = (t && typeof t === 'object' ? (t.name || t.email) : t) || `Teacher ${id}`;
                    if (id && !seen.has(id)) seen.set(id, { value: id, label: String(label) });
                });
                setCourseTeachers([...seen.values()]);
            })
            .catch(() => { if (alive) setCourseTeachers([]); })
            .finally(() => { if (alive) setCtLoading(false); });
        return () => { alive = false; };
    }, [form.course_id]);

    // Options for the teacher dropdown: course-assigned teachers when a course
    // is selected (keep the already-saved teacher visible on edit), else all.
    const teacherOptions = useMemo(() => {
        if (form.course_id && courseTeachers !== null) {
            const opts = [...courseTeachers];
            if (form.teacher_id && !opts.some((o) => o.value === String(form.teacher_id))) {
                const fromAll = teachers.find((t) => t.value === String(form.teacher_id));
                if (fromAll) opts.push(fromAll);
            }
            return opts;
        }
        return teachers;
    }, [form.course_id, form.teacher_id, courseTeachers, teachers]);
    const submit = async (e) => {
        e.preventDefault(); setSubmitting(true);
        try {
            await onSubmit({
                day_of_week: Number(form.day_of_week),
                start_time: form.start_time || null,
                end_time: form.end_time || null,
                course_id: form.course_id || null,
                teacher_id: form.teacher_id || null,
                status: form.status,
            });
        } finally { setSubmitting(false); }
    };
    return (
        <form onSubmit={submit}>
            <div className="mb-3"><label className="ol-form-label">Day of week</label><select className="ol-form-control" value={form.day_of_week} onChange={(e) => set('day_of_week', e.target.value)}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
            <div className="mb-3 grid grid-cols-2 gap-3"><div><label className="ol-form-label">Start time</label><input type="time" className="ol-form-control" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} /></div><div><label className="ol-form-label">End time</label><input type="time" className="ol-form-control" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} /></div></div>
            <div className="mb-3"><label className="ol-form-label">Course</label><select className="ol-form-control" value={form.course_id} onChange={(e) => onCourseChange(e.target.value)}><option value="">— Select a course —</option>{courses.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div className="mb-3">
                <label className="ol-form-label">Teacher</label>
                <select className="ol-form-control" value={form.teacher_id} onChange={(e) => set('teacher_id', e.target.value)} disabled={!form.course_id || ctLoading}>
                    <option value="">
                        {!form.course_id
                            ? '— Select a course first —'
                            : ctLoading
                                ? 'Loading teachers…'
                                : teacherOptions.length === 0
                                    ? 'No teachers assigned to this course'
                                    : '— Select a teacher —'}
                    </option>
                    {teacherOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {form.course_id && !ctLoading && teacherOptions.length === 0 && (
                    <p className="text-[12px] text-gray mt-1">Assign a teacher to this course in <strong>Teacher Assignments</strong> first.</p>
                )}
            </div>
            <div className="mb-3"><label className="ol-form-label">Status</label><select className="ol-form-control" value={form.status} onChange={(e) => set('status', e.target.value)}><option value="1">Active</option><option value="0">Hidden</option></select></div>
            <div className="flex justify-end"><button type="submit" className="ol-btn-primary" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</button></div>
        </form>
    );
}
