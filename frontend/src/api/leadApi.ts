import axios from "axios";

// Public lead capture — portal signup creates a LEAD (no login). Admin follows
// up and converts it into a student account. Unauthenticated by design.
const BASE = (import.meta.env.VITE_ADMIN_API_URL as string) || "http://localhost:5000";

export const captureLead = (payload: Record<string, unknown>) =>
  axios.post(`${BASE}/api/public/leads`, payload).then((r) => r.data);

// Public self sign-up — creates a student account (so the user can log in and
// land on an empty dashboard) AND drops a lead for the team to follow up.
export const publicSignup = (payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) => axios.post(`${BASE}/api/public/signup`, payload).then((r) => r.data);

// Student self-service profile photo upload. Sends the JWT so the backend ties
// the avatar to the verified student. Returns { photo: "<relative R2 path>" }.
export const uploadStudentPhoto = (file: File): Promise<{ photo: string }> => {
  const fd = new FormData();
  fd.append("photo", file);
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  return axios
    .post(`${BASE}/api/public/profile/photo`, fd, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    .then((r) => r.data);
};

// Base used to render a stored relative photo path as a full URL.
export const ADMIN_BASE = BASE;
