import { useEffect, useState } from 'react';
import axios from 'axios';

const ADMIN_BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5000';

// "My Learnings" — the student's own per-lesson note (title + description),
// loaded/saved per (student, lesson) via the public learnings endpoints.
export default function MyLearnings({ courseId, lessonId }) {
    const studentId = localStorage.getItem('userId') || '';
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!studentId || !lessonId) return;
        let cancelled = false;
        setSaved(false);
        axios
            .get(`${ADMIN_BASE}/api/public/learnings/by-student/${studentId}`, {
                params: { lessonId, t: Date.now() }, headers: { 'Cache-Control': 'no-cache' }, timeout: 30000,
            })
            .then(({ data }) => {
                if (cancelled) return;
                const l = data?.learning;
                setTitle(l?.title || '');
                setDescription(l?.description || '');
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [studentId, lessonId]);

    const save = async (e) => {
        e.preventDefault();
        if (!studentId || !lessonId) return;
        setSaving(true); setSaved(false);
        try {
            await axios.post(`${ADMIN_BASE}/api/public/learnings`, { studentId, courseId, lessonId, title, description });
            setSaved(true);
        } catch { /* ignore */ } finally { setSaving(false); }
    };

    if (!lessonId) return null;
    const inputCls = 'w-full rounded-lg border border-gray-200 px-4 py-2.5 outline-none focus:border-primary text-sm';

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mt-5">
            <h3 className="text-[18px] font-bold mb-4">My Learnings</h3>
            {!studentId ? (
                <p className="text-sm text-gray-500">Sign in as a student to save your learnings.</p>
            ) : (
                <form onSubmit={save} className="space-y-3">
                    <div>
                        <label className="block text-[13px] font-semibold mb-1">Title</label>
                        <input className={inputCls} value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} placeholder="Project Title" />
                    </div>
                    <div>
                        <label className="block text-[13px] font-semibold mb-1">Description</label>
                        <textarea rows={4} className={inputCls} value={description} onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
                            placeholder="What did you learn? Make notes of your learning on this topic. It will help you revise the topic later." />
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="submit" className="ol-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        {saved && <span className="text-[13px] text-green-600 font-medium">✓ Saved</span>}
                    </div>
                </form>
            )}
        </div>
    );
}
