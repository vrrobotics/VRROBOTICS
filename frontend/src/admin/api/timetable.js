import api from './client';

// Admin timetable CRUD (admin-service :5000, /api/admin/timetable*). JSON payloads.
export const listTimetable = (params) => api.get('/timetable', { params }).then((r) => r.data);
export const getTimetableEntry = (id) => api.get(`/timetable/edit/${id}`).then((r) => r.data);
export const storeTimetableEntry = (body) => api.post('/timetable/store', body).then((r) => r.data);
export const updateTimetableEntry = (id, body) => api.post(`/timetable/update/${id}`, body).then((r) => r.data);
export const deleteTimetableEntry = (id) => api.delete(`/timetable/delete/${id}`).then((r) => r.data);
export const toggleTimetableStatus = (id) => api.get(`/timetable/status/${id}`).then((r) => r.data);
