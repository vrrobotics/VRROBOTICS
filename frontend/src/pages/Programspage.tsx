import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, FileText, Clock } from "lucide-react";

// All admin-published courses, shown directly to the student (no college
// selection and no pre-assessment gate). Sourced from the public catalog
// endpoint which returns every active course the admin created.
interface CourseCard {
  id: number;
  slug: string;
  title: string;
  short_description?: string;
  thumbnail?: string;
  level?: string;
  lesson_count?: number;
  total_duration_secs?: number;
}

const ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:5000";

const ProgramsPage = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${ADMIN_BASE}/api/public/courses/catalog`, { params: { limit: 48, t: Date.now() }, headers: { "Cache-Control": "no-cache" }, timeout: 30000 })
      .then(({ data }) => { if (!cancelled) setCourses(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setError("Failed to load courses."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Open the course details page (which has "Go to Course" → the player).
  const open = (slug: string) => navigate(`/courses/programs/course-details?slug=${encodeURIComponent(slug)}`);

  const thumbUrl = (c: CourseCard) => {
    const raw = c.thumbnail || "";
    if (!raw) return "";
    return raw.startsWith("http") ? raw : `${ADMIN_BASE}/${raw.replace(/^\/+/, "")}`;
  };

  return (
    <section className="section-padding bg-gradient-subtle">
      <div className="container-ngo max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-gray-800">My Courses</h2>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && !loading && <p className="text-red-600">{error}</p>}
        {!loading && !error && courses.length === 0 && (
          <p className="text-gray-600">No courses available yet.</p>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {!loading && courses.map((course) => {
            const thumb = thumbUrl(course);
            const hours = Math.floor((course.total_duration_secs || 0) / 3600);
            return (
              <Card key={course.id} className="rounded-xl shadow-md hover:shadow-lg transition overflow-hidden">
                {thumb && (
                  <button type="button" onClick={() => open(course.slug)} className="block w-full aspect-video bg-gray-100 overflow-hidden" aria-label="Open course">
                    <img src={thumb} alt={course.title} className="w-full h-full object-cover" />
                  </button>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-[#FF6A00]">{course.title}</CardTitle>
                    <button type="button" onClick={() => open(course.slug)} className="shrink-0 bg-transparent border-0 p-0 text-[#FF6A00] hover:text-[#cc5500] cursor-pointer" aria-label="Open course" title="Open course">
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {course.short_description && (
                    <p className="text-gray-600 mb-3 line-clamp-3">{course.short_description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {course.level && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 capitalize">{course.level}</span>
                    )}
                    <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {course.lesson_count || 0} {course.lesson_count === 1 ? "Lesson" : "Lessons"}</span>
                    {hours > 0 && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {hours}+ Hours</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProgramsPage;
