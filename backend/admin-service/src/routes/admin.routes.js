const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/AdminController');
const dash = require('../controllers/DashboardController');

router.get('/dashboard', dash.index);

router.get('/admins', ctrl.index);
router.get('/admins/:id', ctrl.show);
router.post('/admins', upload.single('photo'), ctrl.store);
// Grant/revoke full root-dashboard access (root admin only — enforced in ctrl).
router.post('/admins/:id/grant-access', ctrl.grantAccess);
router.post('/admins/:id/revoke-access', ctrl.revokeAccess);
router.post('/admins/:id', upload.single('photo'), ctrl.update);
router.delete('/admins/:id', ctrl.destroy);

module.exports = router;
