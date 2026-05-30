const router = require('express').Router();
const upload = require('../middlewares/multer');
const ctrl = require('../controllers/TeacherController');

// upload.single('photo') parses the multipart FormData (same as admin
// routes) so req.body holds the text fields. The photo file itself is
// accepted but not persisted yet — the auth users table has no photo
// column for teachers; harmless to receive and ignore.
// Namespaced under /manage to avoid colliding with the pre-existing
// liveclass route GET /teachers (the live-class teacher picker),
// which is registered earlier and would otherwise shadow these.
router.get('/manage/teachers', ctrl.index);
router.get('/manage/teachers/:id', ctrl.show);
router.post('/manage/teachers', upload.single('photo'), ctrl.store);
router.post('/manage/teachers/:id', upload.single('photo'), ctrl.update);
router.delete('/manage/teachers/:id', ctrl.destroy);

module.exports = router;
