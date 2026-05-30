import { Play, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * VR Robotics Academy — Gallery page (new page; existing content untouched).
 * All photos/videos are placeholders.
 */

const Placeholder = ({ label, tint = "from-orange-400 to-orange-600", className = "", showPlay = false }: { label: string; tint?: string; className?: string; showPlay?: boolean }) => (
  <div className={`relative flex items-center justify-center bg-gradient-to-br ${tint} text-white ${className}`}>
    {showPlay ? (
      <span className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center">
        <Play className="w-7 h-7 fill-white ml-1" />
      </span>
    ) : (
      <div className="flex flex-col items-center gap-1 opacity-90">
        <ImageIcon className="w-8 h-8" />
        <span className="text-xs font-medium">{label}</span>
      </div>
    )}
    <span className="absolute top-2 right-2 text-[10px] bg-black/30 px-1.5 py-0.5 rounded">Placeholder</span>
  </div>
);

const items = [
  { date: "SAT, MAY 02, 2026", title: "Celebrating Excellence: National Gold", tint: "from-emerald-500 to-teal-700" },
  { date: "SAT, JAN 17, 2026", title: "RRL26 — Robotics in Aerospace", tint: "from-indigo-500 to-blue-700" },
  { date: "SAT, AUG 02, 2025", title: "VR Robotics Triumph: Three Wins at WRO 2025!", tint: "from-rose-500 to-red-700" },
  { date: "FRI, JUL 11, 2025", title: "Hands-On Robotics Workshop", tint: "from-amber-500 to-orange-600" },
  { date: "MON, JUN 09, 2025", title: "Founder's Keynote & Vision", tint: "from-violet-500 to-purple-700" },
  { date: "SAT, APR 19, 2025", title: "Student Project Showcase", tint: "from-cyan-600 to-blue-700" },
];

const Gallery = () => {
  return (
    <div className="overflow-hidden">
      <section className="section-padding">
        <div className="container-ngo">
          <div className="text-center space-y-3 mb-10">
            <p className="text-primary font-semibold uppercase tracking-wide text-sm">VR Robotics Academy</p>
            <h1 className="text-4xl md:text-5xl font-bold">Gallery</h1>
            <p className="text-muted-foreground">Moments from our events, competitions, and classrooms.</p>
          </div>

          {/* Feature video placeholder */}
          <Placeholder label="" showPlay className="rounded-3xl aspect-video mb-12" tint="from-slate-700 to-slate-900" />

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((it) => (
              <Card key={it.title} className="card-ngo border-0 overflow-hidden">
                <Placeholder label="Event photo" tint={it.tint} className="h-52" />
                <CardContent className="p-5 space-y-1">
                  <p className="text-warm-green text-xs font-semibold">{it.date}</p>
                  <h3 className="font-semibold text-lg">{it.title}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Gallery;
