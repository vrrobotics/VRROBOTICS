import { createRemoteJWKSet, jwtVerify } from 'jose';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

const jwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;
const hsSecret = SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(SUPABASE_JWT_SECRET)
  : null;
// Local admin JWT (issued by admin-service AuthService.signToken with JWT_SECRET).
// Root/college admins authenticate with this, NOT a Supabase token, so the
// assessment admin endpoints must also accept it. Same secret value as admin-service.
const adminSecret = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

// Returns { payload, kind } where kind is 'supabase' (student/teacher) or
// 'admin' (admin-service local JWT), or null if no verifier accepts the token.
async function verifyToken(token) {
  if (jwks) {
    try { return { payload: (await jwtVerify(token, jwks)).payload, kind: 'supabase' }; } catch (_) {}
  }
  if (hsSecret) {
    try { return { payload: (await jwtVerify(token, hsSecret, { algorithms: ['HS256'] })).payload, kind: 'supabase' }; } catch (_) {}
  }
  if (adminSecret) {
    try { return { payload: (await jwtVerify(token, adminSecret, { algorithms: ['HS256'] })).payload, kind: 'admin' }; } catch (_) {}
  }
  return null;
}

export default async function isLoggedIn(req, res, next) {
  try {
    const authHeader = req.headers?.authorization;
    const token =
      req.cookies?.accessToken ||
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    if (!jwks && !hsSecret && !adminSecret) return res.status(500).json({ error: 'Auth not configured' });

    const verified = await verifyToken(token);
    if (!verified) return res.status(401).json({ error: 'Invalid or expired token' });
    const { payload, kind } = verified;

    if (kind === 'admin') {
      // admin-service local JWT: { id, email, role, name, college_id, is_root_admin }
      req.user = {
        id: payload.id,
        email: payload.email,
        role: payload.is_root_admin ? 'admin' : (payload.role || null),
        collegeId: payload.college_id ?? null,
        isRootAdmin: !!payload.is_root_admin,
      };
    } else {
      req.user = {
        id: payload.sub,
        email: payload.email,
        // app_metadata only — user_metadata is user-editable and must not drive authz.
        role: payload.app_metadata?.role || null,
        supabaseUid: payload.sub,
      };
    }
    next();
  } catch (error) {
    console.error('isLoggedIn middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
