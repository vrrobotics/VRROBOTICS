const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/GalleryController');

// Multipart (image/video) on create + update; `media` is the file field.
router.get('/gallery', ctrl.index);
router.get('/gallery/edit/:id', ctrl.show);
router.post('/gallery/store', upload.single('media'), ctrl.store);
router.post('/gallery/update/:id', upload.single('media'), ctrl.update);
router.delete('/gallery/delete/:id', ctrl.delete);
router.get('/gallery/status/:id', ctrl.status);

module.exports = router;
