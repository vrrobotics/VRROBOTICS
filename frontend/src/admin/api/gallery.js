import api from './client';

// Admin gallery CRUD (admin-service :5000, /api/admin/gallery*).
// store/update send multipart/form-data because they may carry an image/video.
export const listGallery = (params) => api.get('/gallery', { params }).then((r) => r.data);
export const getGalleryItem = (id) => api.get(`/gallery/edit/${id}`).then((r) => r.data);
export const storeGalleryItem = (fd) =>
    api.post('/gallery/store', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateGalleryItem = (id, fd) =>
    api.post(`/gallery/update/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteGalleryItem = (id) => api.delete(`/gallery/delete/${id}`).then((r) => r.data);
export const toggleGalleryStatus = (id) => api.get(`/gallery/status/${id}`).then((r) => r.data);
