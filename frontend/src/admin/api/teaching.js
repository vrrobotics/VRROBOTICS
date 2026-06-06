import api from './client';

// Teacher-delegation endpoints (admin-service /api/admin/teaching-assignments).
// Mounted with adminOrTeacher: admin creates assignments + edits roster; the
// teacher reads their own assignments and releases lessons. The server returns
// 403 for actions a teacher may not perform, which the caller handles.

// course_id is optional — admins can filter the list to one course.
export const listAssignments = (courseId) =>
    api.get('/teaching-assignments', { params: courseId ? { course_id: courseId } : {} }).then((r) => r.data);

export const createAssignment = (payload) =>
    api.post('/teaching-assignments', payload).then((r) => r.data);

export const deleteAssignment = (id) =>
    api.delete(`/teaching-assignments/${id}`).then((r) => r.data);

export const getRoster = (id) =>
    api.get(`/teaching-assignments/${id}/roster`).then((r) => r.data);

// Per-student completion of released lessons.
export const getProgress = (id) =>
    api.get(`/teaching-assignments/${id}/progress`).then((r) => r.data);

// payload: { batchIds?: [], studentIds?: [] }
export const addMembers = (id, payload) =>
    api.post(`/teaching-assignments/${id}/members`, payload).then((r) => r.data);

// payload: { member_type: 'batch'|'student', member_ref }
export const removeMember = (id, payload) =>
    api.delete(`/teaching-assignments/${id}/members`, { data: payload }).then((r) => r.data);

export const listReleases = (id) =>
    api.get(`/teaching-assignments/${id}/releases`).then((r) => r.data);

// payload: { lessonIds: [], released_at?: ISOString }
export const releaseLessons = (id, payload) =>
    api.post(`/teaching-assignments/${id}/releases`, payload).then((r) => r.data);

export const revokeRelease = (id, releaseId) =>
    api.delete(`/teaching-assignments/${id}/releases/${releaseId}`).then((r) => r.data);
