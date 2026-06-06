import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyCourses } from "@/api/course/courseApi";

const BASE = (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:5000";

type MyCourse = {
  id: number;
  slug: string;
  title: string;
  thumbnail?: string;
  banner?: string;
  progress?: number;
  lesson_count?: number;
};

// Resolve a possibly-relative thumbnail path to a full URL.
const imgUrl = (c: MyCourse) => {
  const raw = c.thumbnail || c.banner || "";
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `${BASE}/${raw.replace(/^\/+/, "")}`;
};

// The student's owned courses: paid ∪ enrolled ∪ delegated (school/batch),
// from the canonical lms_admin /api/public/my-courses. Renders nothing when the
// student has none (so the Programs view below remains the entry point).
export default function MyCoursesGrid() {
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyCourses()
      .then((rows) => setCourses((rows as MyCourse[]) || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || courses.length === 0) return null;

  return (
    <section className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">My Courses</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => {
          const pct = Math.max(0, Math.min(100, Number(c.progress) || 0));
          const thumb = imgUrl(c);
          return (
            <Link
              key={c.id}
              to={`/courses/programs/course-details/play/${c.slug}`}
              className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100 overflow-hidden">
                {thumb ? (
                  <img src={thumb} alt={c.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">▶</div>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold text-gray-900 line-clamp-2 mb-2">{c.title}</p>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-gray-500">
                  <span>{pct}% complete</span>
                  <span className="text-emerald-600 font-semibold">{pct > 0 ? "Continue" : "Start"} →</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
