import axios from 'axios';

const BASTION_BASE: string =
  import.meta.env.VITE_BASTION_API_URL ?? 'http://localhost:8000';

const axiosInstance = axios.create({
  baseURL: `${BASTION_BASE}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // This is crucial for cookies to work
});

// Attach Authorization header if accessToken exists
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Endpoints whose 401 the GLOBAL interceptor must NOT turn into a hard redirect
// to /login — the caller already handles it:
//   /auth/profile  — speculative "am I logged in?" probe (401 == not logged in).
//                    Redirecting here re-mounts AuthProvider, which re-probes,
//                    401s again, reloads… an infinite loop.
//   /auth/login, /auth/register, /auth/refresh — an admin signs in here too, and
//                    auth-service returns 401 for admin-only accounts ON PURPOSE
//                    so AuthProvider can fall back to admin-service. If the
//                    interceptor hard-redirects on that expected 401, the page
//                    reloads and ABORTS the admin-service fallback, so the admin
//                    never reaches /admin. The Auth form shows its own error for
//                    a genuine wrong-password 401, so a redirect here is wrong.
const SILENT_AUTH_PATHS = ['/auth/profile', '/auth/login', '/auth/register', '/auth/refresh'];

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url: string = error.config?.url || '';
      const isSilent = SILENT_AUTH_PATHS.some((p) => url.includes(p));
      // The unified auth screen lives at /auth (with /login redirecting to it),
      // so treat both as "on the login page" — a 401 while the user is actively
      // signing in must never trigger a competing hard redirect.
      const onLoginPage =
        typeof window !== 'undefined' &&
        (window.location.pathname === '/login' || window.location.pathname === '/auth');

      // Only hard-redirect to /login when the user is GENUINELY logged out
      // (no access token stored). When a token IS present, a 401 from a
      // single background widget (e.g. a feature endpoint whose service is
      // down or returns 401) must NOT nuke the whole session — that caused
      // the post-login "dashboard then bounce back to /login" loop. In that
      // case we let the individual component handle its own failed request.
      const hasToken =
        typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken'));

      if (!isSilent && !onLoginPage && !hasToken && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
