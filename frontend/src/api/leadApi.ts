import axios from "axios";

// Public lead capture — portal signup creates a LEAD (no login). Admin follows
// up and converts it into a student account. Unauthenticated by design.
const BASE = (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:5000";

export const captureLead = (payload: Record<string, unknown>) =>
  axios.post(`${BASE}/api/public/leads`, payload).then((r) => r.data);
