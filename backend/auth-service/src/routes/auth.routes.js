import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import * as controller from '../controllers/auth.controller.js';
import isLoggedIn from '../middlewares/isLoggedin.js';
import authRoles from '../middlewares/authRoles.js';

const router = Router();

// Brute-force protection on credential endpoints. The global limiter (200/min)
// is too loose to stop password-guessing; this caps auth attempts per IP+email.
// Keyed on IP + submitted email so one attacker IP can't lock out everyone, and
// a single targeted account is still throttled. trust proxy is set in app.js so
// req.ip is the real client behind Railway's proxy.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  max: 10, // 10 attempts per window per IP+email
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').trim().toLowerCase()}`,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

router.post('/register', authLimiter, controller.register);
router.post('/login', authLimiter, controller.login);
router.post('/refresh', controller.refresh);
router.get('/profile', isLoggedIn, controller.profile);
router.put('/profile/update', isLoggedIn, controller.updateProfile);
router.put('/profile/update/edu', isLoggedIn, authRoles(['student', 'teacher']), controller.updateEducation);
router.put('/profile/update/org-clg-branch', isLoggedIn, authRoles(['student', 'teacher']), controller.updateOrgClgBranch);
router.put("/profile/prescore", isLoggedIn, authRoles(['student']), controller.preScore)
router.put("/profile/postscore", isLoggedIn, authRoles(['student']), controller.postScore)
router.post('/change-password', isLoggedIn, controller.changePassword);
router.post('/logout', isLoggedIn, controller.logout);

export default router;
