import api from './client';

// Teachers live in the auth-service users table (role = 'teacher').
// Path is namespaced under /manage because the live-class feature already
// owns GET /teachers (registered earlier on the server) — without the
// prefix that route shadows these admin CRUD endpoints.
export const listTeachers = (params) =>
    api.get('/manage/teachers', { params }).then((r) => r.data);
export const getTeacher = (id) =>
    api.get(`/manage/teachers/${id}`).then((r) => r.data);
export const createTeacher = (body) =>
    api.post('/manage/teachers', body).then((r) => r.data);
export const updateTeacher = (id, body) =>
    api.post(`/manage/teachers/${id}`, body).then((r) => r.data);
export const deleteTeacher = (id) =>
    api.delete(`/manage/teachers/${id}`).then((r) => r.data);
