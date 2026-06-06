import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Layers, GraduationCap, Users, ArrowUpRight, PieChart } from 'lucide-react';
import { dashboardStats } from '../../api/admin';
import { leadStats } from '../../api/leads';

// Attractive stat card: colored icon badge, big bold number, soft gradient
// background, left accent bar, and a hover lift. `accent` carries the metric's
// solid color + a soft tint for the badge/background.
const StatCard = ({ icon: Icon, count, label, to, accent }) => {
    const card = (
        <div
            className="group relative overflow-hidden rounded-ol-12 border border-ebordermuted bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]"
            style={{ background: `linear-gradient(135deg, ${accent.tint} 0%, #ffffff 60%)` }}
        >
            <span className="absolute left-0 top-0 h-full w-1.5" style={{ backgroundColor: accent.solid }} />
            <div className="flex items-start justify-between">
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: accent.solid, color: '#fff' }}
                >
                    <Icon className="w-6 h-6" />
                </div>
                {to && (
                    <span className="text-gray opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowUpRight className="w-4 h-4" />
                    </span>
                )}
            </div>
            <p className="text-[30px] font-extrabold text-dark leading-none mt-4 tabular-nums">{count}</p>
            <p className="text-[13px] text-gray mt-1.5">{label}</p>
        </div>
    );
    return to ? <Link to={to} className="block">{card}</Link> : card;
};

const StatusLegend = ({ label, value, color, pct }) => (
    <li className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
        <span className="text-[13px] text-dark flex-1">{label}</span>
        <span className="text-[12px] text-gray font-semibold tabular-nums">{value}</span>
        <span className="text-[11px] text-gray w-9 text-right tabular-nums">{pct}%</span>
    </li>
);

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newLeads, setNewLeads] = useState(0);

    // Lead alert — best-effort; a failure here must not break the dashboard.
    useEffect(() => {
        leadStats().then((s) => setNewLeads(s?.new || 0)).catch(() => {});
    }, []);

    // Pulled out of useEffect so the error-state Retry button can call it too.
    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await dashboardStats();
            setData(res);
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-skin rounded-full animate-spin mb-3" />
                <p className="text-[14px]">Loading dashboard…</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="ol-card rounded-ol-8">
                <div className="ol-card-body py-10 px-6 text-center">
                    <p className="text-[16px] font-semibold text-danger mb-2">Couldn’t load dashboard</p>
                    <p className="text-[13px] text-gray mb-4">{error}</p>
                    <button className="ol-btn-primary" onClick={load}>Retry</button>
                </div>
            </div>
        );
    }

    const { stats = {}, status_counts = {} } = data;

    const cards = [
        { key: 'course_count', label: 'Total Courses', icon: BookOpen, to: '/admin/courses', accent: { solid: '#3b82f6', tint: 'rgba(59,130,246,0.10)' } },
        { key: 'lesson_count', label: 'Total Lessons', icon: Layers, to: '/admin/courses', accent: { solid: '#8b5cf6', tint: 'rgba(139,92,246,0.10)' } },
        { key: 'enrollment_count', label: 'Total Enrollments', icon: GraduationCap, to: '/admin/students', accent: { solid: '#12c093', tint: 'rgba(18,192,147,0.10)' } },
        { key: 'student_count', label: 'Total Students', icon: Users, to: '/admin/students', accent: { solid: '#FF6A00', tint: 'rgba(255,106,0,0.10)' } },
    ];

    const statusItems = [
        { key: 'active', label: 'Active', color: '#12c093' },
        { key: 'upcoming', label: 'Upcoming', color: '#FF6A00' },
        { key: 'pending', label: 'Pending', color: '#ff2583' },
        { key: 'private', label: 'Private', color: '#6366f1' },
        { key: 'draft', label: 'Draft', color: '#878d97' },
        { key: 'inactive', label: 'Inactive', color: '#dadada' },
    ];
    const totalStatus = statusItems.reduce((s, i) => s + (status_counts[i.key] || 0), 0) || 1;
    const totalCourses = statusItems.reduce((s, i) => s + (status_counts[i.key] || 0), 0);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="rounded-ol-12 p-5 text-white" style={{ background: 'var(--gradient-hero, linear-gradient(135deg,#FF6A00,#ff2583))' }}>
                <h4 className="text-[20px] font-bold m-0">Dashboard</h4>
                <p className="text-[13px] opacity-90 mt-1">Overview of your platform at a glance.</p>
            </div>

            {/* New-leads alert — new portal signups awaiting follow-up. */}
            {newLeads > 0 && (
                <Link to="/admin/leads?status=new" className="block rounded-ol-12 border border-blue-200 bg-blue-50 px-5 py-4 hover:bg-blue-100 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[14px] text-blue-800 font-semibold">
                            🔔 {newLeads} new lead{newLeads > 1 ? 's' : ''} waiting for follow-up
                        </span>
                        <span className="text-[12px] text-blue-700 font-semibold inline-flex items-center gap-1">
                            Review leads <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                    </div>
                </Link>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {cards.map((c) => (
                    <StatCard
                        key={c.key}
                        icon={c.icon}
                        count={(stats[c.key] || 0).toLocaleString()}
                        label={c.label}
                        to={c.to}
                        accent={c.accent}
                    />
                ))}
            </div>

            {/* Course status breakdown */}
            <div className="rounded-ol-12 border border-ebordermuted bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[15px] font-semibold text-dark flex items-center gap-2 m-0">
                        <PieChart className="w-4 h-4 text-skin" /> Course Status
                    </h4>
                    <Link to="/admin/courses" className="text-skin text-[12px] font-semibold inline-flex items-center gap-1">
                        Explore <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
                <div className="flex items-center gap-6 flex-wrap">
                    {/* Donut with center total */}
                    <div
                        className="relative w-[160px] h-[160px] rounded-full flex-shrink-0"
                        style={{
                            background: `conic-gradient(${statusItems.map((i, idx, arr) => {
                                const prev = arr.slice(0, idx).reduce((s, x) => s + (status_counts[x.key] || 0), 0);
                                const cur = prev + (status_counts[i.key] || 0);
                                return `${i.color} ${(prev / totalStatus) * 360}deg ${(cur / totalStatus) * 360}deg`;
                            }).join(', ')})`,
                        }}
                    >
                        <div className="absolute inset-0 m-auto w-[100px] h-[100px] rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                            <span className="text-[24px] font-extrabold text-dark leading-none tabular-nums">{totalCourses}</span>
                            <span className="text-[11px] text-gray mt-0.5">Courses</span>
                        </div>
                    </div>
                    {/* Legend */}
                    <ul className="flex-1 min-w-[220px] m-0 p-0 list-none">
                        {statusItems.map((i) => {
                            const v = status_counts[i.key] || 0;
                            return (
                                <StatusLegend
                                    key={i.key}
                                    label={i.label}
                                    value={v}
                                    color={i.color}
                                    pct={Math.round((v / totalStatus) * 100)}
                                />
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
}
