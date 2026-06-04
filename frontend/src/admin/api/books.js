import api from './client';

// Admin books CRUD (admin-service :5000, /api/admin/books*).
// store/update send multipart/form-data because they may carry a cover image.
export const listBooks = (params) => api.get('/books', { params }).then((r) => r.data);
export const getBook = (id) => api.get(`/books/edit/${id}`).then((r) => r.data);
export const storeBook = (fd) =>
    api.post('/books/store', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateBook = (id, fd) =>
    api.post(`/books/update/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteBook = (id) => api.delete(`/books/delete/${id}`).then((r) => r.data);
export const toggleBookStatus = (id) => api.get(`/books/status/${id}`).then((r) => r.data);
