import { createRemoteJWKSet, jwtVerify } from 'jose';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

const jwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;
const hsSecret = SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(SUPABASE_JWT_SECRET)
  : null;

async function verifyToken(token) {
  if (jwks) {
    try { return (await jwtVerify(token, jwks)).payload; } catch (_) {}
  }
  if (hsSecret) {
    try { return (await jwtVerify(token, hsSecret, { algorithms: ['HS256'] })).payload; } catch (_) {}
  }
  return null;
}

export default async function isLoggedIn(req, res, next) {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.accessToken || bearer;

    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    if (!jwks && !hsSecret) return res.status(500).json({ error: 'Auth not configured' });

    const payload = await verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role || payload.app_metadata?.role || null,
      supabaseUid: payload.sub,
    };
    next();
  } catch (error) {
    console.error('isLoggedIn middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
