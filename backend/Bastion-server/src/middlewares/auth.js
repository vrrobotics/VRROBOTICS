// Bastion JWT verifier — supports both Supabase JWT styles:
//   - new asymmetric keys (RS256/ES256, via JWKS endpoint)
//   - legacy HS256 with the project's JWT secret
// JWKS first, HS256 fallback.
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

const authMiddleware = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1] || req.cookies?.accessToken;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  if (!jwks && !hsSecret) {
    return res.status(500).json({ error: 'Bastion auth not configured' });
  }

  const payload = await verifyToken(token);
  if (!payload) return res.status(403).json({ error: 'Invalid or expired token' });

  req.user = {
    id: payload.sub,
    email: payload.email,
    // app_metadata only — user_metadata is user-editable and must not drive authz.
    role: payload.app_metadata?.role || null,
    supabaseUid: payload.sub,
  };
  next();
};

export default authMiddleware;
