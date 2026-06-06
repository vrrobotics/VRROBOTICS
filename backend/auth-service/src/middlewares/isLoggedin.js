import { createRemoteJWKSet, jwtVerify } from 'jose';
import User from '../db/models/User.js';

// Supabase issues access tokens. Newer projects sign them with asymmetric
// JWT Signing Keys (RS256/ES256, served via JWKS). Legacy projects use
// HS256 with the project's JWT secret. We try JWKS first, then fall back
// to HS256 so both styles work without config drift.

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

const jwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

const hsSecret = SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(SUPABASE_JWT_SECRET)
  : null;

async function verifySupabaseToken(token) {
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks);
      return payload;
    } catch (_) {
      // fall through to HS256
    }
  }
  if (hsSecret) {
    try {
      const { payload } = await jwtVerify(token, hsSecret, { algorithms: ['HS256'] });
      return payload;
    } catch (_) {
      // both verification paths failed
    }
  }
  return null;
}

// Small profile cache (uid -> profile) so we don't hit the DB on every
// authenticated request. 5min TTL.
const profileCache = new Map();
const PROFILE_TTL_MS = 5 * 60 * 1000;

async function loadProfile(supabaseUid, emailFromToken) {
  const hit = profileCache.get(supabaseUid);
  if (hit && hit.expires > Date.now()) return hit.value;

  let profile = await User.findOne({ where: { passwordHash: `supabase:${supabaseUid}` } });
  if (!profile && emailFromToken) {
    profile = await User.findOne({ where: { email: emailFromToken } });
  }
  if (!profile) return null;

  const value = {
    id: profile.userId,
    userId: profile.userId,
    email: profile.email,
    roleId: profile.roleId,
    collegeId: profile.collegeId,
  };
  profileCache.set(supabaseUid, { value, expires: Date.now() + PROFILE_TTL_MS });
  return value;
}

export default async function isLoggedIn(req, res, next) {
  try {
    const authHeader = req.headers?.authorization;
    const token =
      req.cookies?.accessToken ||
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    if (!jwks && !hsSecret) {
      console.error('[auth] Neither SUPABASE_URL nor SUPABASE_JWT_SECRET configured');
      return res.status(500).json({ error: 'Auth not configured' });
    }

    const payload = await verifySupabaseToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const profile = await loadProfile(payload.sub, payload.email);
    if (!profile) {
      return res.status(403).json({ error: 'Profile not found for token subject' });
    }

    req.user = {
      ...profile,
      supabaseUid: payload.sub,
      // app_metadata only — user_metadata is user-editable and must not drive authz.
      role: payload.app_metadata?.role || null,
    };
    next();
  } catch (error) {
    console.error('isLoggedIn middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
