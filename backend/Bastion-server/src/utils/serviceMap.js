const serviceMap = {
  auth: {
    path: 'auth',
    url: process.env.AUTH_SERVICE_URL || '',
    host: process.env.AUTH_SERVICE_HOST || 'localhost',
    port: process.env.AUTH_SERVICE_PORT || 8001,
  },
  course: {
    path: 'course',
    url: process.env.COURSE_SERVICE_URL || '',
    host: process.env.COURSE_SERVICE_HOST || 'localhost',
    port: process.env.COURSE_SERVICE_PORT || 8002,
  },
  assessment: {
    path: 'assessment',
    url: process.env.ASSESSMENT_SERVICE_URL || '',
    host: process.env.ASSESSMENT_SERVICE_HOST || 'localhost',
    port: process.env.ASSESSMENT_SERVICE_PORT || 8003,
  },
  organisation: {
    path: 'organisation',
    url: process.env.ORG_SERVICE_URL || process.env.ORGANISATION_SERVICE_URL || '',
    host: process.env.ORGANISATION_SERVICE_HOST || 'localhost',
    port: process.env.ORGANISATION_SERVICE_PORT || 8004,
  },
  college: {
    path: 'college',
    url: process.env.COLLEGE_SERVICE_URL || '',
    host: process.env.COLLEGE_SERVICE_HOST || 'localhost',
    port: process.env.COLLEGE_SERVICE_PORT || 8005,
  },
  payment: {
    path: 'payment',
    url: process.env.PAYMENT_SERVICE_URL || '',
    host: process.env.PAYMENT_SERVICE_HOST || 'localhost',
    port: process.env.PAYMENT_SERVICE_PORT || 8006,
  },
  admin: {
    path: 'admin',
    url: process.env.ADMIN_SERVICE_URL || '',
    host: process.env.ADMIN_SERVICE_HOST || 'localhost',
    port: process.env.ADMIN_SERVICE_PORT || 8007,
    stripPrefix: '/api/v1/admin',
    // admin-service mounts its admin routes at `/api/admin/*` (e.g. the login is
    // `/api/admin/auth/login`). With forwardPrefix '/api' the gateway forwarded
    // to `/api/auth/login`, which 404s. The frontend currently calls admin-service
    // directly so this was latent, but the mapping must match the real mount.
    forwardPrefix: '/api/admin',
  },

};

// Resolve a service's base target. Prefer a full URL (e.g. a Railway public
// HTTPS domain set via <SVC>_SERVICE_URL) so production needs no host/port or
// http→https juggling; fall back to http://host:port for local/compose dev.
export function targetFor(service) {
  if (service.url) return service.url.replace(/\/+$/, '');
  return `http://${service.host}:${service.port}`;
}

export default serviceMap;
