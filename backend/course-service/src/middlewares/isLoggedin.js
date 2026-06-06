import { createRemoteJWKSet, jwtVerify } from 'jose';

// Verify Supabase access tokens. New projects use asymmetric JWT Signing
// Keys (RS256/ES256, served via JWKS). Legacy projects use HS256 with the
// project's JWT secret. Try JWKS first, fall back to HS256.

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
    const authHeader = req.headers?.authorization;
    const token =
      req.cookies?.accessToken ||
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    if (!jwks && !hsSecret) {
      return res.status(500).json({ error: 'Auth not configured (SUPABASE_URL or SUPABASE_JWT_SECRET missing)' });
    }

    const payload = await verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

    req.user = {
      id: payload.sub,
      email: payload.email,
      // app_metadata only — user_metadata is user-editable and must not drive authz.
      role: payload.app_metadata?.role || null,
      supabaseUid: payload.sub,
    };
    next();
  } catch (error) {
    console.error('isLoggedIn middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
