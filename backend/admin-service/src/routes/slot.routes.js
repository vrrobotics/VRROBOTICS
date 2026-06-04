const router = require('express').Router();
const ctrl = require('../controllers/SlotController');

// JSON CRUD (no file uploads). course_id + teacher_ids/student_ids arrays.
// Enrolled students for a course (course-driven student picker in the form).
router.get('/slots/course-students/:courseId', ctrl.courseStudents);
router.get('/slots', ctrl.index);
router.get('/slots/edit/:id', ctrl.show);
router.post('/slots/store', ctrl.store);
router.post('/slots/update/:id', ctrl.update);
router.delete('/slots/delete/:id', ctrl.delete);
router.get('/slots/status/:id', ctrl.status);

module.exports = router;
