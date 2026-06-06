const router = require('express').Router();
const ctrl = require('../controllers/LeadController');

// Admin lead pipeline — mounted under /api/admin with adminOnly (see server.js).
// /leads/stats is declared before the :id routes so it isn't shadowed.
router.get('/leads', ctrl.list);
router.get('/leads/stats', ctrl.stats);
router.put('/leads/:id', ctrl.update);
router.post('/leads/:id/convert', ctrl.convert);
router.delete('/leads/:id', ctrl.remove);

module.exports = router;
