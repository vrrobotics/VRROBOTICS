import api from './client';

export const listAdmins = (params) => api.get('/admins', { params }).then((r) => r.data);
export const getAdmin = (id) => api.get(`/admins/${id}`).then((r) => r.data);
export const createAdmin = (fd) => api.post('/admins', fd).then((r) => r.data);
export const updateAdmin = (id, fd) => api.post(`/admins/${id}`, fd).then((r) => r.data);
export const deleteAdmin = (id) => api.delete(`/admins/${id}`).then((r) => r.data);

// Grant / revoke full root-dashboard access for another admin (root only).
export const grantAdminAccess = (id) => api.post(`/admins/${id}/grant-access`).then((r) => r.data);
export const revokeAdminAccess = (id) => api.post(`/admins/${id}/revoke-access`).then((r) => r.data);

export const dashboardStats = () => api.get('/dashboard').then((r) => r.data);
