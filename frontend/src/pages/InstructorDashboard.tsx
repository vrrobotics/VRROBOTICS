import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  MessageSquare,
  MonitorPlay,
  Table2,
  Users,
  Library,
  Contact,
  Megaphone,
  IndianRupee,
  ClipboardList,
  Power,
  Info,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

/**
 * VR Robotics Academy — Instructor (Mentor) Dashboard.
 * Standalone dashboard view (its own sidebar; rendered outside the marketing
 * Layout). New addition only — does not change any existing functionality.
 */

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Slots", icon: CalendarDays },
  { name: "Demos", icon: MessageSquare },
  { name: "Classes", icon: MonitorPlay },
  { name: "Time table", icon: Table2 },
  { name: "Students", icon: Users },
  { name: "Resources", icon: Library },
  { name: "Profile", icon: Contact },
  { name: "Referral", icon: Megaphone },
  { name: "Payout", icon: IndianRupee },
  { name: "Tasks", icon: ClipboardList },
];

/**
 * TODO(backend): replace this static placeholder with live data.
 * Suggested API: GET /api/instructor/earnings?month=YYYY-MM  (auth: instructor)
 * returning a payload shaped exactly like `DashboardData` below, so wiring is a
 * drop-in. See the commented useEffect in the component for the fetch scaffold.
 */
type DashboardData = {
  month: string;
  earnings: { demos: string; classes: string; other: string };
  penalties: { penalizedClasses: string; disputedSessions: string };
  demos: { successful: string; unsuccessful: string; conversions: string };
  classes: { paid: string; unsuccessful: string; cancelled: string; punctuality: string };
};

const PLACEHOLDER_DATA: DashboardData = {
  month: "May 2026",
  earnings: { demos: "₹0", classes: "₹0", other: "₹0" },
  penalties: { penalizedClasses: "—", disputedSessions: "—" },
  demos: { successful: "0", unsuccessful: "0", conversions: "—" },
  classes: { paid: "0", unsuccessful: "0", cancelled: "0", punctuality: "0%" },
};

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="flex-1 min-w-[140px] rounded-xl bg-muted/60 px-5 py-4">
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
  </div>
);

const InstructorDashboard = () => {
  const [active, setActive] = useState("Dashboard");
  const [data] = useState<DashboardData>(PLACEHOLDER_DATA);

  // TODO(backend): connect to the instructor earnings API. Uncomment & adapt:
  // useEffect(() => {
  //   axios
  //     .get(`/api/instructor/earnings?month=2026-05`)
  //     .then((res) => setData(res.data))
  //     .catch(() => setData(PLACEHOLDER_DATA));
  // }, []);

  return (
    <div className="min-h-screen flex bg-[#f4f4f5]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-gradient-to-b from-[#fff6ee] to-white border-r border-orange-100 flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-6 h-20 border-b border-orange-100">
          <div className="w-9 h-9 rounded-full bg-gradient-hero" />
          <span className="font-heading text-xl font-extrabold">
            <span className="text-gradient">VR</span> Robotics
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {navItems.map((item) => {
            const on = active === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActive(item.name)}
                className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  on
                    ? "bg-primary/10 text-primary border-r-4 border-primary"
                    : "text-muted-foreground hover:bg-orange-50 hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-left">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <Link
          to="/"
          className="flex items-center gap-3 px-6 py-4 text-sm font-semibold text-red-500 border-t border-orange-100 hover:bg-red-50"
        >
          <Power className="w-5 h-5" /> Logout
        </Link>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {active === "Dashboard" ? (
          <>
            {/* Earnings card */}
            <section className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
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
            <section className="bg-white rounded-2xl shadow-sm p-6">
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
            <section className="bg-white rounded-2xl shadow-sm p-6">
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
            <section className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-bold mb-2">Other earnings</h2>
              <p className="text-muted-foreground">No other earnings</p>
            </section>

            {/* Penalized classes */}
            <section className="bg-white rounded-2xl shadow-sm p-6">
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
            <section className="bg-white rounded-2xl shadow-sm p-4">
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
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
            <h1 className="text-2xl font-bold mb-2">{active}</h1>
            <p className="text-muted-foreground">This section is coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default InstructorDashboard;
