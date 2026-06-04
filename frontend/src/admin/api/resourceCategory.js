import api from './client';

// Admin-managed resource categories (admin-service :5000, /api/admin/resource-categories*).
export const listResourceCategories = () => api.get('/resource-categories').then((r) => r.data);
export const storeResourceCategory = (body) => api.post('/resource-categories/store', body).then((r) => r.data);
export const updateResourceCategory = (id, body) => api.post(`/resource-categories/update/${id}`, body).then((r) => r.data);
export const deleteResourceCategory = (id) => api.delete(`/resource-categories/delete/${id}`).then((r) => r.data);
