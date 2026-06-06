import api from './client';

// Admin email/SMTP settings (Brevo etc.). Base client points at /api/admin.
export const getEmailSettings = () => api.get('/settings/email').then((r) => r.data);
export const saveEmailSettings = (body) => api.put('/settings/email', body).then((r) => r.data);
export const sendTestEmail = (to) => api.post('/settings/email/test', { to }).then((r) => r.data);
