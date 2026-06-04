import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { GraduationCap, FileText, Clock, ArrowRight } from "lucide-react";

const ADMIN_BASE =
  (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:5000";

interface CourseItem {
  id: number;
  title: string;
  slug: string;
  short_description: string;
  thumbnail: string;
  level: string;
  class_from: number | null;
  class_to: number | null;
  lesson_count: number;
  total_duration_secs: number;
}

// Class buckets shown as filter pills (and mirrored in the navbar dropdown).
// `value` is the ?class= param ("from-to"); empty = all courses.
const BUCKETS: { label: string; value: string }[] = [
  { label: "All Courses", value: "" },
  { label: "Class 8 – 12", value: "8-12" },
  { label: "Class 12 – 18", value: "12-18" },
];

const parseBucket = (raw: string | null): { from: number; to: number } | null => {
  if (!raw) return null;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  return { from: Number(m[1]), to: Number(m[2]) };
};

const classLabel = (c: CourseItem): string => {
  if (c.class_from == null && c.class_to == null) return "All classes";
  if (c.class_from != null && c.class_to != null) return `Class ${c.class_from}–${c.class_to}`;
  if (c.class_from != null) return `Class ${c.class_from}+`;
  return `Up to Class ${c.class_to}`;
};

const CourseCatalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeClass = searchParams.get("class") || "";
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const bucket = parseBucket(activeClass);
    const params: Record<string, string | number> = { limit: 48, t: Date.now() };
    if (bucket) {
      params.classFrom = bucket.from;
      params.classTo = bucket.to;
    }
    axios
      .get(`${ADMIN_BASE}/api/public/courses/catalog`, { params, timeout: 30000 })
      .then(({ data }) => {
        if (!cancelled) setCourses(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClass]);

  const selectBucket = (value: string) => {
    if (value) setSearchParams({ class: value });
    else setSearchParams({});
  };

  return (
    <div className="section-padding">
      <div className="container-ngo">
        <div className="text-center space-y-3 mb-10">
          <p className="text-primary font-semibold">Courses</p>
          <h2 className="text-3xl md:text-4xl font-bold">
            Explore courses <span className="text-gradient">by class</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Pick a class range to see the courses available for those students.
          </p>
        </div>

        {/* Class filter pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          {BUCKETS.map((b) => {
            const active = activeClass === b.value;
            return (
              <button
                key={b.label}
                type="button"
                onClick={() => selectBucket(b.value)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                  active
                    ? "bg-gradient-hero text-white shadow-md"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-16">Loading courses…</p>
        ) : courses.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            No courses found for this class range yet.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((c) => {
              const hours = Math.floor((c.total_duration_secs || 0) / 3600);
              return (
                <Link
                  key={c.id}
                  to={`/courses/programs/course-details?slug=${encodeURIComponent(c.slug)}`}
                  className="card-ngo-static border-0 group overflow-hidden flex flex-col h-full rounded-2xl"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                    {c.thumbnail ? (
                      <img
                        src={c.thumbnail}
                        alt={c.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-hero">
                        <GraduationCap className="w-14 h-14 text-white/80" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-background/85 backdrop-blur text-xs font-semibold text-primary shadow-sm">
                      {classLabel(c)}
                    </span>
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="font-bold text-xl mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {c.title}
                    </h3>
                    {c.short_description && (
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">
                        {c.short_description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center gap-6 pt-4 border-t border-border/60 text-sm font-medium">
                      <span className="inline-flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        {c.lesson_count} {c.lesson_count === 1 ? "Lesson" : "Lessons"}
                      </span>
                      {hours > 0 && (
                        <span className="inline-flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          {hours}+ Hours
                        </span>
                      )}
                      <ArrowRight className="w-4 h-4 ml-auto text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseCatalog;
