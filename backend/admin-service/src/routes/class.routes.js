const router = require('express').Router();
const ctrl = require('../controllers/ClassSessionController');

router.get('/classes', ctrl.index);
router.get('/classes/edit/:id', ctrl.show);
router.post('/classes/store', ctrl.store);
router.post('/classes/update/:id', ctrl.update);
router.delete('/classes/delete/:id', ctrl.delete);
router.get('/classes/status/:id', ctrl.status);

module.exports = router;
