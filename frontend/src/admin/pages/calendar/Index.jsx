import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, eachDayOfInterval, addDays, set as setTime } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { listSlots } from '../../api/slot';
import { listDemos } from '../../api/demo';
import { listClasses } from '../../api/class';
import { listTimetable } from '../../api/timetable';

const localizer = dateFnsLocalizer({
  format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales: { 'en-US': enUS },
});

// Visual identity per scheduled type.
const TYPES = {
  slot:      { label: 'Slots',      color: '#2563eb', addTo: '/admin/slots' },      // blue
  demo:      { label: 'Demos',      color: '#16a34a', addTo: '/admin/demos' },      // green
  class:     { label: 'Classes',    color: '#ea580c', addTo: '/admin/classes' },    // orange
  timetable: { label: 'Time table', color: '#7c3aed', addTo: '/admin/timetable' },  // purple
};

// list endpoints wrap the array as { slots:{data:[]} } etc — extract defensively.
const rows = (res, key) => res?.[key]?.data || res?.[key] || res?.data || (Array.isArray(res) ? res : []);
const toDate = (v) => (v ? new Date(v) : null);

// Expand a recurring weekly timetable entry (day_of_week 0=Mon..6=Sun,
// start_time/end_time "HH:MM") into concrete events across the visible month.
function expandTimetable(entries, focus) {
  const from = addDays(startOfMonth(focus), -7);
  const to = addDays(endOfMonth(focus), 7);
  const days = eachDayOfInterval({ start: from, end: to });
  const out = [];
  for (const e of entries) {
    const jsDay = ((Number(e.day_of_week) + 1) % 7); // Mon(0)->1 ... Sun(6)->0
    const [sh, sm] = String(e.start_time || '09:00').split(':').map(Number);
    const [eh, em] = String(e.end_time || '10:00').split(':').map(Number);
    for (const d of days) {
      if (getDay(d) !== jsDay) continue;
      out.push({
        id: `timetable-${e.id}-${format(d, 'yyyyMMdd')}`,
        title: `Class · ${e.course_id || ''}`.trim(),
        start: setTime(d, { hours: sh, minutes: sm, seconds: 0, milliseconds: 0 }),
        end: setTime(d, { hours: eh, minutes: em, seconds: 0, milliseconds: 0 }),
        type: 'timetable', raw: e,
      });
    }
  }
  return out;
}

export default function AdminCalendarIndex() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [enabled, setEnabled] = useState({ slot: true, demo: true, class: true, timetable: true });
  const [data, setData] = useState({ slots: [], demos: [], classes: [], timetable: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [addAt, setAddAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { per_page: 1000 };
      const [s, d, c, t] = await Promise.all([
        listSlots(params).catch(() => ({})),
        listDemos(params).catch(() => ({})),
        listClasses(params).catch(() => ({})),
        listTimetable(params).catch(() => ({})),
      ]);
      setData({
        slots: rows(s, 'slots'), demos: rows(d, 'demos'),
        classes: rows(c, 'classes'), timetable: rows(t, 'entries'),
      });
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load schedule');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const events = useMemo(() => {
    const out = [];
    if (enabled.slot) data.slots.forEach((r) => out.push({ id: `slot-${r.id}`, title: r.name || 'Slot', start: toDate(r.start_at), end: toDate(r.end_at) || toDate(r.start_at), type: 'slot', raw: r }));
    if (enabled.demo) data.demos.forEach((r) => out.push({ id: `demo-${r.id}`, title: r.title || 'Demo', start: toDate(r.start_at), end: toDate(r.end_at) || toDate(r.start_at), type: 'demo', raw: r }));
    if (enabled.class) data.classes.forEach((r) => out.push({ id: `class-${r.id}`, title: r.name || 'Class', start: toDate(r.start_at), end: toDate(r.end_at) || toDate(r.start_at), type: 'class', raw: r }));
    if (enabled.timetable) out.push(...expandTimetable(data.timetable, date));
    return out.filter((e) => e.start instanceof Date && !isNaN(e.start));
  }, [data, enabled, date]);

  const eventStyle = useCallback((event) => ({
    style: { backgroundColor: TYPES[event.type]?.color || '#64748b', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, padding: '1px 6px' },
  }), []);

  const counts = {
    slot: data.slots.length, demo: data.demos.length, class: data.classes.length, timetable: data.timetable.length,
  };

  return (
    <div className="p-1">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-bold text-dark m-0">Calendar</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(TYPES).map(([key, t]) => (
            <label key={key} className="flex items-center gap-1.5 text-[13px] cursor-pointer select-none">
              <input type="checkbox" checked={enabled[key]} onChange={() => setEnabled((p) => ({ ...p, [key]: !p[key] }))} />
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: t.color }} />
              {t.label} <span className="text-gray-400">({counts[key]})</span>
            </label>
          ))}
          <button onClick={load} className="text-[13px] px-3 py-1.5 rounded-md border border-border hover:bg-gray-50">Refresh</button>
        </div>
      </div>

      {error && <div className="mb-3 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {loading && <div className="mb-3 text-[13px] text-gray-500">Loading schedule…</div>}

      <div style={{ height: '72vh' }} className="bg-white rounded-xl border border-border p-3">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={date}
          onNavigate={setDate}
          view={view}
          onView={setView}
          views={['month', 'week', 'day', 'agenda']}
          popup
          selectable
          onSelectEvent={(e) => setSelected(e)}
          onSelectSlot={(slotInfo) => setAddAt(slotInfo.start)}
          eventPropGetter={eventStyle}
          style={{ height: '100%' }}
        />
      </div>

      {/* Event details */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: TYPES[selected.type]?.color }} />
              <span className="text-[12px] uppercase tracking-wide text-gray-500">{TYPES[selected.type]?.label}</span>
            </div>
            <h3 className="text-lg font-bold text-dark mt-0 mb-2">{selected.title}</h3>
            <p className="text-[13px] text-gray-600 m-0">
              {selected.start && format(selected.start, 'EEE, dd MMM yyyy · HH:mm')}
              {selected.end && ` – ${format(selected.end, 'HH:mm')}`}
            </p>
            {selected.raw?.course_id && <p className="text-[13px] text-gray-600 m-0 mt-1">Course: {selected.raw.course_id}</p>}
            {selected.raw?.meeting_link && <p className="text-[13px] m-0 mt-1"><a className="text-blue-600 underline" href={selected.raw.meeting_link} target="_blank" rel="noreferrer">Join link</a></p>}
            <div className="mt-4 flex justify-end gap-2">
              <Link to={TYPES[selected.type]?.addTo} className="text-[13px] px-3 py-1.5 rounded-md border border-border hover:bg-gray-50">Manage {TYPES[selected.type]?.label}</Link>
              <button onClick={() => setSelected(null)} className="text-[13px] px-3 py-1.5 rounded-md bg-dark text-white">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add chooser when an empty slot is clicked */}
      {addAt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAddAt(null)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-dark mt-0 mb-1">Schedule on {format(addAt, 'dd MMM yyyy')}</h3>
            <p className="text-[13px] text-gray-500 mt-0 mb-4">What do you want to add?</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPES).map(([key, t]) => (
                <Link key={key} to={t.addTo} className="text-[13px] px-3 py-2 rounded-md border border-border hover:bg-gray-50 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: t.color }} />{t.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex justify-end"><button onClick={() => setAddAt(null)} className="text-[13px] px-3 py-1.5 rounded-md bg-dark text-white">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
