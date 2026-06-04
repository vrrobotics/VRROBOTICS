import api from './client';

// Admin student-projects CRUD (admin-service :5000, /api/admin/projects*).
// store/update send multipart/form-data because they may carry an image.
export const listProjects = (params) => api.get('/projects', { params }).then((r) => r.data);
export const getProject = (id) => api.get(`/projects/edit/${id}`).then((r) => r.data);
export const storeProject = (fd) =>
    api.post('/projects/store', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateProject = (id, fd) =>
    api.post(`/projects/update/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteProject = (id) => api.delete(`/projects/delete/${id}`).then((r) => r.data);
export const toggleProjectStatus = (id) => api.get(`/projects/status/${id}`).then((r) => r.data);
