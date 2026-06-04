const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/BookController');

// Multipart (cover image) on create + update; `cover` is the file field.
router.get('/books', ctrl.index);
router.get('/books/edit/:id', ctrl.show);
router.post('/books/store', upload.single('cover'), ctrl.store);
router.post('/books/update/:id', upload.single('cover'), ctrl.update);
router.delete('/books/delete/:id', ctrl.delete);
router.get('/books/status/:id', ctrl.status);

module.exports = router;
