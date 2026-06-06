const svc = require('../services/TeachingAssignmentService');
const { asyncHandler } = require('../middlewares/error');

// All handlers receive req.user from the auth middleware (admin/root/teacher).
// The service does the per-role scoping (admin manages; teacher reads/releases
// only their own assignments).

// --- Assignments -----------------------------------------------------------
exports.list = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.listAssignments({ user: req.user, courseId: req.query.course_id }));
});

exports.create = asyncHandler(async (req, res) => {
    res.json(await svc.createAssignment({ user: req.user, body: req.body }));
});

exports.destroy = asyncHandler(async (req, res) => {
    res.json(await svc.deleteAssignment({ user: req.user, id: req.params.id }));
});

// --- Roster ----------------------------------------------------------------
exports.roster = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.getRoster({ user: req.user, id: req.params.id }));
});

exports.addMembers = asyncHandler(async (req, res) => {
    res.json(await svc.addMembers({ user: req.user, id: req.params.id, body: req.body }));
});

exports.progress = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.getProgress({ user: req.user, id: req.params.id }));
});

exports.removeMember = asyncHandler(async (req, res) => {
    res.json(await svc.removeMember({ user: req.user, id: req.params.id, body: req.body }));
});

// --- Releases (teacher's daily drip) --------------------------------------
exports.listReleases = asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.listReleases({ user: req.user, id: req.params.id }));
});

exports.release = asyncHandler(async (req, res) => {
    res.json(await svc.createReleases({ user: req.user, id: req.params.id, body: req.body }));
});

exports.revoke = asyncHandler(async (req, res) => {
    res.json(await svc.revokeRelease({ user: req.user, id: req.params.id, releaseId: req.params.releaseId }));
});
