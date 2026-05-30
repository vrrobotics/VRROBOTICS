import { useEffect, useState } from 'react';
import { listTeachers } from '../../../api/teacher';
import CollegeMultiSelect from '../../../components/CollegeMultiSelect';
import BatchMultiSelect from '../../../components/BatchMultiSelect';

// Mirrors the backend parseTeacherIds — teacher_ids comes off the
// course row as a TEXT column that may hold a JSON array, a CSV string, or a
// single bare value. Always returns an array of id strings.
const parseTeacherIds = (raw) => {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    const s = String(raw).trim();
    try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (parsed) return [String(parsed)];
    } catch {
        if (s.includes(',')) return s.split(',').map((v) => v.trim()).filter(Boolean);
        return [s];
    }
    return [];
};

// `categories` prop is kept in the destructure for backwards compatibility
// with Edit.jsx, but it's no longer used — courses are mapped to colleges
// via clg_ids instead of category_id.
export default function BasicTab({ course, onSave, formId }) {
    const currentTeacherId = parseTeacherIds(course.teacher_ids)[0] || '';
    const [f, setF] = useState({
        title: course.title || '',
        short_description: course.short_description || '',
        description: course.description || '',
        // category_id removed — see CollegeMultiSelect below.
        level: course.level || 'beginner',
        language: course.language || 'english',
        // The screenshot offers only Active / Private. Treat everything else as the closer of the two.
        status: course.status === 'private' ? 'private' : 'active',
        // Whether completing the course issues a certificate. Defaults to
        // true for new courses and for legacy rows where the column was
        // missing (the backend payload normalises null to true).
        has_certificate: course.has_certificate === undefined || course.has_certificate === null
            ? true
            : !!course.has_certificate,
        teacher_id: String(currentTeacherId),
    });
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

    // Colleges this course is offered at — pre-selected from course.clg_ids
    // (the JSON column on the courses table). Backend's update path only
    // overwrites the column when clgIds[] is present on the request, so
    // partial saves elsewhere don't wipe the mapping.
    const [selectedClgIds, setSelectedClgIds] = useState(
        Array.isArray(course.clg_ids) ? course.clg_ids : [],
    );

    // Batches scoped to selectedClgIds. Pre-selected from course.batch_ids
    // (JSON column on courses). BatchMultiSelect re-fetches when the college
    // set changes and prunes selections whose college is no longer active,
    // so no extra effect is needed here.
    const [selectedBatchIds, setSelectedBatchIds] = useState(
        Array.isArray(course.batch_ids) ? course.batch_ids.map(Number) : [],
    );

    // Teacher dropdown source — admin teachers API (auth-service users
    // with role='teacher'). Same loader the Create page uses. We pull the
    // full list in one request; the count is small.
    const [teachers, setTeachers] = useState([]);
    const [teachersLoading, setTeachersLoading] = useState(true);
    const [teachersError, setTeachersError] = useState(null);

    useEffect(() => {
        let alive = true;
        setTeachersLoading(true);
        setTeachersError(null);
        listTeachers({ per_page: 1000 })
            .then((r) => { if (alive) setTeachers(r?.teachers || []); })
            .catch((e) => {
                if (alive) setTeachersError(
                    e?.response?.data?.error || e?.message || 'Failed to load teachers'
                );
            })
            .finally(() => { if (alive) setTeachersLoading(false); });
        return () => { alive = false; };
    }, []);

    const submit = (e) => {
        e.preventDefault();
        const fd = new FormData();
        Object.entries(f).forEach(([k, v]) => {
            // teacher_id is sent on the wire as teachers[] (see below).
            if (k === 'teacher_id') return;
            // FormData stringifies booleans to 'true'/'false'; send '1'/'0'
            // so the backend's toBool() reads them as numbers consistently
            // with the other on/off flags (is_paid etc.).
            if (typeof v === 'boolean') fd.append(k, v ? '1' : '0');
            else fd.append(k, v);
        });
        // Prefer the value the admin picked in the dropdown; fall back to
        // whatever was already on the course so a partial save can't wipe
        // the assignment (e.g. teachers list failed to load).
        const chosen = String(f.teacher_id || '').trim();
        const ids = chosen ? [chosen] : parseTeacherIds(course.teacher_ids);
        ids.forEach((id) => fd.append('teachers[]', id));
        // Send clgIds[] when at least one college is selected so the backend
        // replaces the column with the visible state. If the admin cleared
        // every college we send a single empty sentinel so the backend can
        // distinguish "explicitly cleared" from "field not touched" — its
        // normalize step filters falsy values, ending up with `[]` either way.
        if (selectedClgIds.length > 0) {
            selectedClgIds.forEach((id) => fd.append('clgIds[]', id));
        } else {
            fd.append('clgIds[]', '');
        }
        // Same explicit-clear pattern as clgIds[]: send the field even when
        // empty so the backend's partial-save guard knows we intend to wipe
        // it rather than leaving the existing batch_ids untouched.
        if (selectedBatchIds.length > 0) {
            selectedBatchIds.forEach((id) => fd.append('batchIds[]', id));
        } else {
            fd.append('batchIds[]', '');
        }
        onSave(fd);
    };

    return (
        <form id={formId} onSubmit={submit}>
            <Row label="Course title" required>
                <input
                    className="ol-form-control w-full"
                    value={f.title}
                    onChange={(e) => set('title', e.target.value)}
                    required
                />
            </Row>

            <Row label="Short Description">
                <textarea
                    className="ol-form-control w-full"
                    rows="3"
                    value={f.short_description}
                    onChange={(e) => set('short_description', e.target.value)}
                />
            </Row>

            <Row label="Description">
                <textarea
                    className="ol-form-control w-full"
                    rows="8"
                    value={f.description}
                    onChange={(e) => set('description', e.target.value)}
                />
            </Row>

            <Row label="Teacher" required>
                <select
                    className="ol-form-control w-full"
                    value={f.teacher_id}
                    onChange={(e) => set('teacher_id', e.target.value)}
                    disabled={teachersLoading || !!teachersError}
                    required
                >
                    <option value="">
                        {teachersLoading
                            ? 'Loading teachers…'
                            : teachersError
                                ? 'Failed to load teachers'
                                : teachers.length === 0
                                    ? 'No teachers available — add one first'
                                    : 'Select an teacher'}
                    </option>
                    {teachers.map((ins) => {
                        const label = ins.name || ins.email || ins.id;
                        const sub = ins.expertise ? ` — ${ins.expertise}` : '';
                        return (
                            <option key={ins.id} value={String(ins.id)}>
                                {label}{sub}
                            </option>
                        );
                    })}
                </select>
                {teachersError && (
                    <div className="text-[13px] text-danger mt-1">{teachersError}</div>
                )}
                {!teachersLoading && !teachersError && currentTeacherId && !teachers.some((i) => String(i.id) === String(currentTeacherId)) && (
                    <div className="text-[12px] text-gray mt-1">
                        Currently assigned id <code>{currentTeacherId}</code> isn't in the teachers list — selecting a new one will replace it.
                    </div>
                )}
            </Row>

            <Row label="Colleges" required>
                <CollegeMultiSelect
                    value={selectedClgIds}
                    onChange={setSelectedClgIds}
                    hideLabel
                />
            </Row>

            {/* BatchMultiSelect renders its own "Batches" label, so we drop
                Row's label slot to avoid a duplicate. The empty label cell
                keeps the field aligned with the rest of the form's grid. */}
            <Row label="">
                <BatchMultiSelect
                    clgIds={selectedClgIds}
                    value={selectedBatchIds}
                    onChange={setSelectedBatchIds}
                />
            </Row>

            <Row label="Course level" required>
                <select
                    className="ol-form-control w-full"
                    value={f.level}
                    onChange={(e) => set('level', e.target.value)}
                    required
                >
                    <option value="everyone">Everyone</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
            </Row>

            <Row label="Made in" required>
                <select
                    className="ol-form-control w-full"
                    value={f.language}
                    onChange={(e) => set('language', e.target.value)}
                    required
                >
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                    <option value="telugu">Telugu</option>
                    <option value="tamil">Tamil</option>
                    <option value="spanish">Spanish</option>
                    <option value="french">French</option>
                    <option value="german">German</option>
                </select>
            </Row>

            <Row label="Create as" required>
                <div className="flex items-center gap-6 pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="status"
                            value="active"
                            checked={f.status === 'active'}
                            onChange={() => set('status', 'active')}
                            className="accent-skin"
                        />
                        <span className="text-[14px]">Active</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="status"
                            value="private"
                            checked={f.status === 'private'}
                            onChange={() => set('status', 'private')}
                            className="accent-skin"
                        />
                        <span className="text-[14px]">Private</span>
                    </label>
                </div>
            </Row>

            <Row label="Provides certificate">
                <div className="flex items-center gap-6 pt-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="has_certificate"
                            checked={f.has_certificate === true}
                            onChange={() => set('has_certificate', true)}
                            className="accent-skin"
                        />
                        <span className="text-[14px]">Yes</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="has_certificate"
                            checked={f.has_certificate === false}
                            onChange={() => set('has_certificate', false)}
                            className="accent-skin"
                        />
                        <span className="text-[14px]">No</span>
                    </label>
                </div>
            </Row>
        </form>
    );
}

function Row({ label, required, children }) {
    return (
        <div className="grid grid-cols-12 gap-4 mb-4 items-start">
            <label className="col-span-12 md:col-span-3 ol-form-label pt-2">
                {label}
                {required && <span className="text-danger ml-1">*</span>}
            </label>
            <div className="col-span-12 md:col-span-9">
                {children}
            </div>
        </div>
    );
}
