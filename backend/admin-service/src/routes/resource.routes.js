const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/ResourceController');
const rcCtrl = require('../controllers/ResourceCategoryController');

// Resource categories (admin-managed) — drive the teacher dashboard filter.
router.get('/resource-categories', rcCtrl.index);
router.post('/resource-categories/store', rcCtrl.store);
router.post('/resource-categories/update/:id', rcCtrl.update);
router.delete('/resource-categories/delete/:id', rcCtrl.destroy);

// Multiple PDFs per resource → field `files` (array). Stored on R2.
router.get('/resources', ctrl.index);
router.get('/resources/edit/:id', ctrl.show);
router.post('/resources/store', upload.array('files', 20), ctrl.store);
router.post('/resources/update/:id', upload.array('files', 20), ctrl.update);
router.delete('/resources/delete/:id', ctrl.delete);
router.get('/resources/status/:id', ctrl.status);

module.exports = router;
