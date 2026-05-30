import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, Gamepad2, Laptop, Monitor, Hourglass, ImageIcon } from "lucide-react";

/**
 * VR Robotics Academy — Summer Camp 2026 page.
 * New page (does not alter existing content). Image areas use placeholders.
 */

// Reusable image placeholder so every visual slot is clearly a stand-in.
const Placeholder = ({ label, tint = "from-orange-400 to-orange-600", className = "" }: { label: string; tint?: string; className?: string }) => (
  <div className={`relative flex items-center justify-center bg-gradient-to-br ${tint} text-white ${className}`}>
    <div className="flex flex-col items-center gap-1 opacity-90">
      <ImageIcon className="w-8 h-8" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <span className="absolute top-2 right-2 text-[10px] bg-black/30 px-1.5 py-0.5 rounded">Image placeholder</span>
  </div>
);

const camps = [
  { age: "8-12 Yrs", title: "Robot Electronics Summer Camp", hours: "20+ Hours", weeks: "2 Weeks", tint: "from-blue-500 to-indigo-600" },
  { age: "8-12 Yrs", title: "Scratch Game Dev Summer Camp", hours: "20+ Hours", weeks: "2 Weeks", tint: "from-amber-500 to-orange-600" },
  { age: "8-12 Yrs", title: "AI with Scratch Summer Camp", hours: "20+ Hours", weeks: "2 Weeks", tint: "from-slate-700 to-slate-900" },
  { age: "12-18 Yrs", title: "Advanced Electronics Summer Camp", hours: "20+ Hours", weeks: "2 Weeks", tint: "from-violet-500 to-purple-700" },
  { age: "12-18 Yrs", title: "AI Robotics Summer Camp", hours: "20+ Hours", weeks: "2 Weeks", tint: "from-cyan-600 to-blue-700" },
  { age: "14-18 Yrs", title: "Internet of Things (IoT) Summer Camp", hours: "20+ Hours", weeks: "2 Weeks", tint: "from-teal-500 to-emerald-700" },
  { age: "14-18 Yrs", title: "Robot Operating System (ROS) Camp", hours: "20+ Hours", weeks: "2 Weeks", tint: "from-rose-500 to-red-700" },
  { age: "14-18 Yrs", title: "Python Full Stack Summer Camp", hours: "20+ Hours", weeks: "2 Weeks", tint: "from-sky-500 to-indigo-700" },
];

const groups = [
  { icon: Gamepad2, title: "Junior Camps (8-12 years)", text: "Robot Electronics, Adv. Electronics, Scratch Game Dev, Scratch AI" },
  { icon: Laptop, title: "Senior Camps (12-14 years)", text: "Autonomous Robot, Advanced Sensors, Python, Advanced Python" },
  { icon: Monitor, title: "Super Senior Camps (14-18 years)", text: "IoT, ROS, Java Programming, Django Full Stack Web Developer" },
  { icon: Hourglass, title: "Camp Duration", text: "2 weeks, 10 days, 20 hours. Early Bird Offer Ends 28th Feb 2026!" },
];

const SummerCamp = () => {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="bg-gradient-subtle">
        <div className="container-ngo grid lg:grid-cols-2 gap-10 items-center py-16 lg:py-20">
          <div className="space-y-5">
            <p className="text-primary font-semibold uppercase tracking-wide text-sm">VR Robotics Academy</p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              <span className="text-gradient">Robotics Summer Camp 2026!</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Explore the magic of Robotics & AI this summer! Practical, in-person
              camps led by expert engineering trainers.
            </p>
            <div className="flex gap-4">
              <Button size="lg" className="bg-gradient-hero border-0" asChild>
                <Link to="/contact">Know More!</Link>
              </Button>
            </div>
          </div>
          <Placeholder label="Summer Camp banner" className="rounded-3xl aspect-[4/3]" />
        </div>
      </section>

      {/* Many camps to choose from */}
      <section className="section-padding">
        <div className="container-ngo">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">Many camps to choose from!</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {groups.map((g) => (
              <Card key={g.title} className="card-ngo border-0 text-center">
                <CardContent className="p-6 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-hero flex items-center justify-center">
                    <g.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg">{g.title}</h3>
                  <p className="text-muted-foreground text-sm">{g.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Camp cards (Kits Included) */}
      <section className="section-padding bg-gradient-subtle">
        <div className="container-ngo">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-2">Robotics, AI, Coding Camps</h2>
          <p className="text-center text-muted-foreground mb-14">(Kits Included)</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {camps.map((c) => (
              <Card key={c.title} className="card-ngo border-0 overflow-hidden flex flex-col">
                <Placeholder label="Camp image" tint={c.tint} className="h-36" />
                <CardContent className="p-5 flex-1 flex flex-col">
                  <p className="text-primary font-semibold text-sm">{c.age}</p>
                  <h3 className="font-semibold text-lg mt-1 mb-4">{c.title}</h3>
                  <div className="mt-auto flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> {c.hours}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-primary" /> {c.weeks}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button size="lg" className="bg-gradient-hero border-0" asChild>
              <Link to="/contact">Register for the Camp</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SummerCamp;
