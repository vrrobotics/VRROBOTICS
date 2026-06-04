const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/TestimonialController');

// Multipart on create + update; `avatar` is the (optional) file field.
router.get('/testimonials', ctrl.index);
router.get('/testimonials/edit/:id', ctrl.show);
router.post('/testimonials/store', upload.single('avatar'), ctrl.store);
router.post('/testimonials/update/:id', upload.single('avatar'), ctrl.update);
router.delete('/testimonials/delete/:id', ctrl.delete);
router.get('/testimonials/status/:id', ctrl.status);

module.exports = router;
