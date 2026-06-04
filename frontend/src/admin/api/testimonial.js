import api from './client';

// Admin testimonials CRUD (admin-service :5000, /api/admin/testimonials*).
// store/update send multipart/form-data because they may carry an avatar.
export const listTestimonials = (params) => api.get('/testimonials', { params }).then((r) => r.data);
export const getTestimonial = (id) => api.get(`/testimonials/edit/${id}`).then((r) => r.data);
export const storeTestimonial = (fd) =>
    api.post('/testimonials/store', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateTestimonial = (id, fd) =>
    api.post(`/testimonials/update/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteTestimonial = (id) => api.delete(`/testimonials/delete/${id}`).then((r) => r.data);
export const toggleTestimonialStatus = (id) => api.get(`/testimonials/status/${id}`).then((r) => r.data);
