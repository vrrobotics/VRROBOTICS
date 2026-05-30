import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, ImageIcon } from "lucide-react";

/**
 * VR Robotics Academy — Courses page (new page; existing /courses content untouched).
 * Grouped into the four nav-dropdown categories. Course images are placeholders.
 */

const Placeholder = ({ label, tint, className = "" }: { label: string; tint: string; className?: string }) => (
  <div className={`relative flex items-center justify-center bg-gradient-to-br ${tint} text-white ${className}`}>
    <div className="flex flex-col items-center gap-1 opacity-90">
      <ImageIcon className="w-7 h-7" />
      <span className="text-[11px] font-medium text-center px-2">{label}</span>
    </div>
    <span className="absolute top-2 right-2 text-[10px] bg-black/30 px-1.5 py-0.5 rounded">Placeholder</span>
  </div>
);

type Course = { title: string; level: string; duration: string; tint: string };

const sections: { id: string; heading: string; courses: Course[] }[] = [
  {
    id: "age-8-12",
    heading: "For Age 8 - 12",
    courses: [
      { title: "Scratch Game Development", level: "Level 3", duration: "2 Months", tint: "from-amber-500 to-orange-600" },
      { title: "Grade 3 - Science", level: "Level 3", duration: "9 Months", tint: "from-cyan-600 to-blue-700" },
      { title: "AI with Scratch", level: "Level 3", duration: "2 Months", tint: "from-slate-700 to-slate-900" },
      { title: "Robot Electronics", level: "Level 3", duration: "2 Months", tint: "from-blue-500 to-indigo-700" },
    ],
  },
  {
    id: "age-12-18",
    heading: "For Age 12 - 18",
    courses: [
      { title: "Advanced Electronics", level: "Level 4", duration: "3 Months", tint: "from-violet-500 to-purple-700" },
      { title: "AI Robotics", level: "Level 4", duration: "3 Months", tint: "from-cyan-600 to-blue-700" },
      { title: "Python Programming", level: "Level 5", duration: "3 Months", tint: "from-sky-500 to-indigo-700" },
      { title: "Internet of Things (IoT)", level: "Level 5", duration: "3 Months", tint: "from-teal-500 to-emerald-700" },
    ],
  },
  {
    id: "engineering",
    heading: "For Engineering & Fresher",
    courses: [
      { title: "Robot Operating System (ROS)", level: "Advanced", duration: "3 Months", tint: "from-rose-500 to-red-700" },
      { title: "Django Full Stack Web Developer", level: "Advanced", duration: "3 Months", tint: "from-emerald-500 to-teal-700" },
      { title: "Embedded Systems & IoT", level: "Advanced", duration: "3 Months", tint: "from-indigo-500 to-blue-700" },
      { title: "Computer Vision & AI", level: "Advanced", duration: "3 Months", tint: "from-fuchsia-500 to-purple-700" },
    ],
  },
  {
    id: "exams",
    heading: "For Exams",
    courses: [
      { title: "Grade 4 - Math", level: "Level 4", duration: "9 Months", tint: "from-teal-600 to-emerald-700" },
      { title: "Grade 4 - Science", level: "Level 4", duration: "9 Months", tint: "from-pink-500 to-rose-600" },
      { title: "English Excellence & Public Speaking", level: "Level 3", duration: "3 Months", tint: "from-indigo-500 to-purple-600" },
    ],
  },
];

const VrCourses = () => {
  return (
    <div className="overflow-hidden">
      <section className="bg-gradient-subtle">
        <div className="container-ngo py-16 text-center space-y-3">
          <p className="text-primary font-semibold uppercase tracking-wide text-sm">VR Robotics Academy</p>
          <h1 className="text-4xl md:text-5xl font-bold">All Courses</h1>
          <p className="text-muted-foreground">Robotics, AI, Coding, Science & more — for every age and goal.</p>
        </div>
      </section>

      {sections.map((sec, i) => (
        <section
          key={sec.id}
          id={sec.id}
          className={`section-padding ${i % 2 === 1 ? "bg-gradient-subtle" : ""}`}
        >
          <div className="container-ngo">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{sec.heading}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {sec.courses.map((c) => (
                <Card key={c.title} className="card-ngo border-0 overflow-hidden flex flex-col">
                  <Placeholder label="Course image" tint={c.tint} className="h-36" />
                  <CardContent className="p-5 flex-1 flex flex-col">
                    <p className="text-warm-green font-semibold text-sm">{c.level}</p>
                    <h3 className="font-semibold text-lg mt-1 mb-4">{c.title}</h3>
                    <div className="mt-auto flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> {c.level}</span>
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-primary" /> {c.duration}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="section-padding pt-0">
        <div className="container-ngo text-center">
          <Button size="lg" className="bg-gradient-hero border-0" asChild>
            <Link to="/contact">Book a Free Demo</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default VrCourses;
