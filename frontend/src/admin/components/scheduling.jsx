import { useState } from 'react';

// Shared helpers + UI for the scheduling admin pages (Demos, Classes, Timetable).

// Format an ISO datetime for display in tables.
export const fmtDateTime = (raw) => {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

// <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` in local time.
export const toLocalInput = (raw) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 0 = Monday … 6 = Sunday (matches the backend TimetableEntry day_of_week).
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Searchable checkbox multi-select. Keeps the chosen ids in `selected`.
export function MultiSelect({ label, options, selected, onChange, emptyHint }) {
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
