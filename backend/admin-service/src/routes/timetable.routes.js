const router = require('express').Router();
const ctrl = require('../controllers/TimetableEntryController');

router.get('/timetable', ctrl.index);
router.get('/timetable/edit/:id', ctrl.show);
router.post('/timetable/store', ctrl.store);
router.post('/timetable/update/:id', ctrl.update);
router.delete('/timetable/delete/:id', ctrl.delete);
router.get('/timetable/status/:id', ctrl.status);

module.exports = router;
