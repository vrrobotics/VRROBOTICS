const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/ProjectController');

// Multipart on create + update; `image` is the file field.
router.get('/projects', ctrl.index);
router.get('/projects/edit/:id', ctrl.show);
router.post('/projects/store', upload.single('image'), ctrl.store);
router.post('/projects/update/:id', upload.single('image'), ctrl.update);
router.delete('/projects/delete/:id', ctrl.delete);
router.get('/projects/status/:id', ctrl.status);

module.exports = router;
