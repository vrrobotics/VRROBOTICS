import { useEffect, useState } from "react";
import { getLeaderboard, getMyCourses } from "@/api/course/courseApi";

type Row = { user_id: string; name: string; completed: number; quiz_points: number; score: number; rank: number };
type MyCourse = { id: number; title: string };

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`);

// Student leaderboard: overall by default, or per-course via the dropdown.
// "You" is highlighted, and shown pinned at the bottom if outside the top.
export default function Leaderboard() {
  const myId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [courseId, setCourseId] = useState<number | "">(""); // "" = overall
  const [data, setData] = useState<Awaited<ReturnType<typeof getLeaderboard>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyCourses().then((rows) => setCourses((rows as MyCourse[]) || [])).catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(courseId === "" ? undefined : Number(courseId))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [courseId]);

  const rows: Row[] = data?.leaderboard ?? [];
  const me = data?.me ?? null;
  const meInTop = me && rows.some((r) => r.user_id === me.user_id);

  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 m-0">Leaderboard</h3>
        <select
          className="border border-gray-200 rounded-lg text-sm px-3 py-1.5 bg-white"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Overall</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-6">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-6">No rankings yet — complete lessons and quizzes to climb the board.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-2.5 font-semibold w-16">Rank</th>
                <th className="px-4 py-2.5 font-semibold">Student</th>
                <th className="px-4 py-2.5 font-semibold text-right">Lessons</th>
                <th className="px-4 py-2.5 font-semibold text-right">Quiz</th>
                <th className="px-4 py-2.5 font-semibold text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isMe = myId && r.user_id === myId;
                return (
                  <tr key={r.user_id} className={`border-t border-gray-100 ${isMe ? "bg-emerald-50" : ""}`}>
                    <td className="px-4 py-2.5 font-semibold">{medal(r.rank)}</td>
                    <td className="px-4 py-2.5 text-gray-900">{r.name}{isMe ? " (You)" : ""}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{r.completed}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{r.quiz_points}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900">{r.score}</td>
                  </tr>
                );
              })}
              {me && !meInTop && (
                <tr className="border-t-2 border-emerald-200 bg-emerald-50">
                  <td className="px-4 py-2.5 font-semibold">#{me.rank}</td>
                  <td className="px-4 py-2.5 text-gray-900">{me.name} (You)</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{me.completed}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{me.quiz_points}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-900">{me.score}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
