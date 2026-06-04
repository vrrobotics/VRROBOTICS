import { useState } from 'react';
import { Info, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

/**
 * MentorPanel — the Teacher (Mentor) Dashboard feature set for school admins.
 * Controlled by a `section` prop: navigation lives in the College Admin SIDEBAR
 * (see AdminLayout), so this renders exactly ONE section at a time (no in-page
 * tab strip). Mirrors src/pages/TeacherDashboard.tsx field-for-field: the
 * Dashboard section shows earnings / penalties / demos / classes / incentives;
 * every other section shows the same "coming soon" placeholder.
 *
 * Adds teacher-dashboard functionality to school admins WITHOUT changing any
 * existing college dashboard behaviour.
 */

// Section labels surfaced as college-admin sidebar items (order matches the
// teacher dashboard). Slugs are used in the /admin/college?tab= URL.
export const MENTOR_SECTIONS = [
    { slug: 'mentor', label: 'Mentor Dashboard' },
    { slug: 'mentor-slots', label: 'Slots' },
    { slug: 'mentor-demos', label: 'Demos' },
    { slug: 'mentor-classes', label: 'Classes' },
    { slug: 'mentor-timetable', label: 'Time table' },
    { slug: 'mentor-students', label: 'Students' },
    { slug: 'mentor-resources', label: 'Resources' },
    { slug: 'mentor-profile', label: 'Profile' },
    { slug: 'mentor-referral', label: 'Referral' },
    { slug: 'mentor-payout', label: 'Payout' },
    { slug: 'mentor-tasks', label: 'Tasks' },
];

/**
 * TODO(backend): replace this static placeholder with live data.
 * Suggested API: GET /api/teacher/earnings?month=YYYY-MM returning a payload
 * shaped like DashboardData below, so wiring is a drop-in (same as the
 * standalone TeacherDashboard).
 */
const PLACEHOLDER_DATA = {
    month: 'May 2026',
    earnings: { demos: '₹0', classes: '₹0', other: '₹0' },
    penalties: { penalizedClasses: '—', disputedSessions: '—' },
    demos: { successful: '0', unsuccessful: '0', conversions: '—' },
    classes: { paid: '0', unsuccessful: '0', cancelled: '0', punctuality: '0%' },
};

const Stat = ({ value, label }) => (
    <div className="flex-1 min-w-[140px] rounded-xl bg-muted/60 px-5 py-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
    </div>
);

// `section` is the label of the section to show ("Mentor Dashboard" renders the
// earnings view; anything else shows the placeholder — same as the teacher page).
export default function MentorPanel({ section = 'Mentor Dashboard' }) {
    const [data] = useState(PLACEHOLDER_DATA);
    const isDashboard = section === 'Mentor Dashboard' || section === 'Dashboard';

    // TODO(backend): connect to the teacher earnings API. Uncomment & adapt:
    // useEffect(() => {
    //   axios.get(`/api/teacher/earnings?month=2026-05`)
    //     .then((res) => setData(res.data)).catch(() => setData(PLACEHOLDER_DATA));
    // }, []);

    return (
        <div className="ol-card mt-3">
            <div className="ol-card-body p-4">
                <h4 className="text-[16px] font-semibold text-dark mb-3">{section}</h4>

                {isDashboard ? (
                    <div className="space-y-6">
                        {/* Earnings card */}
                        <section className="bg-white rounded-2xl shadow-sm p-6 space-y-5 border border-ebordermuted">
                            <h1 className="text-2xl font-bold">
                                My earnings for <span className="text-blue-600">{data.month}</span>
                            </h1>

                            {/* Dispute banner */}
                            <div className="rounded-xl bg-[#fff6ee] p-5 flex items-center justify-between gap-4 flex-wrap">
                                <div className="h-1.5 w-16 rounded bg-primary" />
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                                        Noticed an issue in your earnings or penalties? <Info className="w-4 h-4" />
                                    </p>
                                    <button className="text-blue-600 font-semibold inline-flex items-center gap-1">
                                        Raise dispute <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Earnings summary */}
                            <div className="rounded-xl bg-muted/40 p-5">
                                <h2 className="font-semibold mb-4">Earnings summary</h2>
                                <div className="flex flex-wrap gap-4">
                                    <Stat value={data.earnings.demos} label="Earnings on demos" />
                                    <Stat value={data.earnings.classes} label="Earnings on classes" />
                                    <Stat value={data.earnings.other} label="Other earnings" />
                                </div>
                            </div>

                            {/* Penalties summary */}
                            <div className="rounded-xl bg-muted/40 p-5">
                                <h2 className="font-semibold mb-4">Penalties summary</h2>
                                <div className="flex flex-wrap gap-4">
                                    <Stat value={data.penalties.penalizedClasses} label="Penalized classes" />
                                    <Stat value={data.penalties.disputedSessions} label="Disputed sessions" />
                                </div>
                            </div>
                        </section>

                        {/* Demos */}
                        <section className="bg-white rounded-2xl shadow-sm p-6 border border-ebordermuted">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold">Demos</h2>
                                <button className="text-blue-600 font-semibold inline-flex items-center gap-1">
                                    View details <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <Stat value={data.demos.successful} label="Successful demos" />
                                <Stat value={data.demos.unsuccessful} label="Unsuccessful demos" />
                                <Stat value={data.demos.conversions} label="Conversions" />
                            </div>
                        </section>

                        {/* Classes */}
                        <section className="bg-white rounded-2xl shadow-sm p-6 border border-ebordermuted">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold">Classes</h2>
                                <button className="text-blue-600 font-semibold inline-flex items-center gap-1">
                                    View details <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <Stat value={data.classes.paid} label="Paid" />
                                <Stat value={data.classes.unsuccessful} label="Unsuccessful" />
                                <Stat value={data.classes.cancelled} label="Cancelled" />
                                <Stat value={data.classes.punctuality} label="Punctuality %" />
                            </div>
                        </section>

                        {/* Other earnings */}
                        <section className="bg-white rounded-2xl shadow-sm p-6 border border-ebordermuted">
                            <h2 className="text-xl font-bold mb-2">Other earnings</h2>
                            <p className="text-muted-foreground">No other earnings</p>
                        </section>

                        {/* Penalized classes */}
                        <section className="bg-white rounded-2xl shadow-sm p-6 border border-ebordermuted">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    Penalized classes
                                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm">—</span>
                                </h2>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Info className="w-4 h-4" /> Detailed breakdown available in 'View details' under 'Classes'
                                </p>
                            </div>
                            <p className="text-muted-foreground">No penalized classes</p>
                        </section>

                        {/* Incentives banner */}
                        <section className="bg-white rounded-2xl shadow-sm p-4 border border-ebordermuted">
                            <div className="flex items-center gap-3">
                                <button className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 hover:bg-muted">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="flex-1 grid md:grid-cols-2 gap-4 rounded-2xl bg-[#1e1e2a] text-white p-6">
                                    <div>
                                        <h3 className="text-xl font-bold mb-3">
                                            Earn more <span className="text-primary">incentives</span> from every class
                                        </h3>
                                        <ul className="space-y-2 text-sm text-white/80">
                                            <li className="bg-white/5 rounded-lg px-3 py-2"><span className="text-primary font-semibold">Earn ₹1250</span> by achieving 90+ mentor rating</li>
                                            <li className="bg-white/5 rounded-lg px-3 py-2"><span className="text-primary font-semibold">Earn ₹750</span> by completing 24 classes with same student</li>
                                            <li className="bg-white/5 rounded-lg px-3 py-2"><span className="text-primary font-semibold">Earn ₹1000</span> by completing 48 classes with same student</li>
                                            <li className="bg-white/5 rounded-lg px-3 py-2"><span className="text-primary font-semibold">Earn ₹1000</span> by successfully upselling or cross-selling</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-3">
                                            Refer. <span className="text-primary">Earn.</span> Repeat.
                                        </h3>
                                        <ul className="space-y-2 text-sm text-white/80">
                                            <li className="bg-white/5 rounded-lg px-3 py-2"><span className="text-primary font-semibold">Earn ₹1000</span> by referring a mentor who completes 75 teaching hours</li>
                                            <li className="bg-white/5 rounded-lg px-3 py-2"><span className="text-primary font-semibold">Earn up to ₹1800</span> (₹300 for demo + ₹1500 for enrollment) by referring a student</li>
                                        </ul>
                                    </div>
                                </div>
                                <button className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 hover:bg-muted">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm p-16 text-center border border-ebordermuted">
                        <h1 className="text-2xl font-bold mb-2">{section}</h1>
                        <p className="text-muted-foreground">This section is coming soon.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
