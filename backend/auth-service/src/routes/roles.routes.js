import { Router } from 'express';
import * as controller from '../controllers/role.controller.js';
import isLoggedIn from '../middlewares/isLoggedin.js';
import authRoles from '../middlewares/authRoles.js';

const router = Router();

// Was unauthenticated — locked to admins. Roles are also seeded at boot.
router.post('/add', isLoggedIn, authRoles(['admin']), controller.addRole);
router.get('/list', isLoggedIn, authRoles(['admin']), controller.listRoles);
router.delete('/delete', isLoggedIn, authRoles(['admin']), controller.deleteRole);
router.post('/assign', isLoggedIn, authRoles(['admin']), controller.assignRoleToUser);

export default router;
