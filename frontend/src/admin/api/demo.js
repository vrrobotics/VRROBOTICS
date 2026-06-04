import api from './client';

// Admin demos CRUD (admin-service :5000, /api/admin/demos*). JSON payloads.
export const listDemos = (params) => api.get('/demos', { params }).then((r) => r.data);
export const getDemo = (id) => api.get(`/demos/edit/${id}`).then((r) => r.data);
export const storeDemo = (body) => api.post('/demos/store', body).then((r) => r.data);
export const updateDemo = (id, body) => api.post(`/demos/update/${id}`, body).then((r) => r.data);
export const deleteDemo = (id) => api.delete(`/demos/delete/${id}`).then((r) => r.data);
export const toggleDemoStatus = (id) => api.get(`/demos/status/${id}`).then((r) => r.data);
