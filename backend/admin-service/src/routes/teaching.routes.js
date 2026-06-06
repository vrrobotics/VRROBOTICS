const router = require('express').Router();
const ctrl = require('../controllers/TeachingAssignmentController');

// Mounted under /api/admin with the `adminOrTeacher` gate (see server.js).
// The service enforces the finer rule:
//   - admin/root  → create/delete assignments, edit roster (add/remove members)
//   - teacher     → read OWN assignments + roster, release/revoke lessons
// Admin-only actions throw 403 inside the service for teachers.

// Assignments
router.get('/teaching-assignments', ctrl.list);
router.post('/teaching-assignments', ctrl.create);            // admin only (service-gated)
router.delete('/teaching-assignments/:id', ctrl.destroy);     // admin only

// Roster
router.get('/teaching-assignments/:id/roster', ctrl.roster);
router.get('/teaching-assignments/:id/progress', ctrl.progress);
router.post('/teaching-assignments/:id/members', ctrl.addMembers);       // admin only
router.delete('/teaching-assignments/:id/members', ctrl.removeMember);   // admin only

// Releases — the teacher's daily drip
router.get('/teaching-assignments/:id/releases', ctrl.listReleases);
router.post('/teaching-assignments/:id/releases', ctrl.release);
router.delete('/teaching-assignments/:id/releases/:releaseId', ctrl.revoke);

module.exports = router;
