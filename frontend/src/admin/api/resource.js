import api from './client';

// Admin resources CRUD (admin-service :5000, /api/admin/resources*).
// store/update send multipart/form-data — `files` carries one-or-more PDFs.
export const listResources = (params) => api.get('/resources', { params }).then((r) => r.data);
export const getResource = (id) => api.get(`/resources/edit/${id}`).then((r) => r.data);
export const storeResource = (fd) =>
    api.post('/resources/store', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateResource = (id, fd) =>
    api.post(`/resources/update/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteResource = (id) => api.delete(`/resources/delete/${id}`).then((r) => r.data);
export const toggleResourceStatus = (id) => api.get(`/resources/status/${id}`).then((r) => r.data);
