const router = require('express').Router();
const ctrl = require('../controllers/DemoController');

router.get('/demos', ctrl.index);
router.get('/demos/edit/:id', ctrl.show);
router.post('/demos/store', ctrl.store);
router.post('/demos/update/:id', ctrl.update);
router.delete('/demos/delete/:id', ctrl.delete);
router.get('/demos/status/:id', ctrl.status);

module.exports = router;
