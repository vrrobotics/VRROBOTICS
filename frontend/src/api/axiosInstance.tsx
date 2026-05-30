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

// Endpoints that AuthProvider/Pages probe speculatively to detect login state.
// A 401 on these is the *expected* "not logged in" signal — it must NOT trigger
// a redirect, otherwise the page reload re-mounts AuthProvider, which re-probes,
// which 401s again, which reloads… an infinite loop visible as repeated
// "GET /api/v1/auth/profile 401" entries in the Bastion proxy log.
const SILENT_AUTH_PATHS = ['/auth/profile'];

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url: string = error.config?.url || '';
      const isSilent = SILENT_AUTH_PATHS.some((p) => url.includes(p));
      const onLoginPage =
        typeof window !== 'undefined' && window.location.pathname === '/login';

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
