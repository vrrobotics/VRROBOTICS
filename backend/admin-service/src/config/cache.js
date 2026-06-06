// Optional Redis cache (Upstash). GRACEFUL BY DESIGN: if REDIS_URL is unset or
// Redis is unreachable, every call no-ops and the request still works — caching
// must never break the app. Used to shield Postgres from hot reads at scale
// (leaderboard, catalog, etc.).
const Redis = require('ioredis');

const url = process.env.REDIS_URL || '';
let client = null;
let ready = false;
let loggedErr = false;

if (url) {
    try {
        client = new Redis(url, {
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false, // fail fast instead of hanging when down
            connectTimeout: 5000,
            tls: url.startsWith('rediss://') ? {} : undefined,
        });
        client.on('ready', () => { ready = true; console.log('[cache] Redis connected'); });
        client.on('end', () => { ready = false; });
        client.on('error', (e) => {
            ready = false;
            if (!loggedErr) { console.warn('[cache] Redis error (caching disabled until reconnect):', e.message); loggedErr = true; }
        });
    } catch (e) {
        console.warn('[cache] init failed — caching disabled:', e.message);
        client = null;
    }
} else {
    console.warn('[cache] REDIS_URL not set — caching disabled (app still works)');
}

const get = async (key) => {
    if (!client || !ready) return null;
    try {
        const v = await client.get(key);
        return v ? JSON.parse(v) : null;
    } catch { return null; }
};

const set = async (key, value, ttlSeconds) => {
    if (!client || !ready || value === undefined || value === null) return;
    try { await client.set(key, JSON.stringify(value), 'EX', Math.max(1, Number(ttlSeconds) || 60)); }
    catch { /* ignore */ }
};

// Delete keys by exact key or a glob pattern (used for invalidation on writes).
const del = async (keyOrPattern) => {
    if (!client || !ready) return;
    try {
        if (keyOrPattern.includes('*')) {
            const keys = await client.keys(keyOrPattern);
            if (keys.length) await client.del(keys);
        } else {
            await client.del(keyOrPattern);
        }
    } catch { /* ignore */ }
};

// Cache-aside: return cached value, or compute via fn(), cache it, and return.
const wrap = async (key, ttlSeconds, fn) => {
    const cached = await get(key);
    if (cached !== null) return cached;
    const fresh = await fn();
    await set(key, fresh, ttlSeconds);
    return fresh;
};

const isEnabled = () => Boolean(client);

// Raw ioredis handle for consumers that need it directly (e.g. a shared
// rate-limit store across replicas). May be null when REDIS_URL is unset —
// callers MUST treat null as "no Redis" and fall back gracefully.
const getClient = () => client;

module.exports = { get, set, del, wrap, isEnabled, getClient };
