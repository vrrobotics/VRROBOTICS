const { AppSetting } = require('../models');
const env = require('../config/env');

// Admin-editable email/SMTP config. Stored in app_settings (key/value); DB
// values take precedence over .env so the admin can configure Brevo from the
// dashboard in production without a redeploy. A short cache avoids a DB read
// on every email send.
const KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'lms_login_url'];

let cache = null;
let cacheAt = 0;
const TTL_MS = 30 * 1000;

const readRows = async () => {
    const rows = await AppSetting.findAll({ where: { key: KEYS }, raw: true });
    const map = {};
    rows.forEach((r) => { map[r.key] = r.value; });
    return map;
};

// Resolved config the mailer uses: DB value wins when non-empty, else .env.
const getEmailConfig = async () => {
    if (cache && Date.now() - cacheAt < TTL_MS) return cache;
    let db = {};
    try { db = await readRows(); } catch (e) { console.warn('[settings] read failed, using env:', e.message); }
    const pick = (k, envVal) => (db[k] !== undefined && db[k] !== null && db[k] !== '' ? db[k] : envVal);
    cache = {
        host: pick('smtp_host', env.mail.host),
        port: Number(pick('smtp_port', env.mail.port)) || 587,
        user: pick('smtp_user', env.mail.user),
        pass: pick('smtp_pass', env.mail.pass),
        from: pick('smtp_from', env.mail.from),
        lmsLoginUrl: pick('lms_login_url', env.mail.lmsLoginUrl),
    };
    cacheAt = Date.now();
    return cache;
};

// What the admin form shows — never returns the real password (only whether
// one is set). `source` tells the admin if a value comes from DB or .env.
const getEmailSettingsMasked = async () => {
    const db = await readRows();
    const val = (k, envVal) => (db[k] !== undefined && db[k] !== null && db[k] !== '' ? db[k] : (envVal || ''));
    const dbHasPass = !!(db.smtp_pass && db.smtp_pass !== '');
    return {
        smtp_host: val('smtp_host', env.mail.host),
        smtp_port: String(val('smtp_port', env.mail.port) || 587),
        smtp_user: val('smtp_user', env.mail.user),
        smtp_from: val('smtp_from', env.mail.from),
        lms_login_url: val('lms_login_url', env.mail.lmsLoginUrl),
        smtp_pass_set: dbHasPass || !!env.mail.pass,
        // where the effective config currently comes from (helps the admin debug)
        source: db.smtp_host ? 'dashboard' : (env.mail.host ? 'env' : 'unset'),
    };
};

const upsert = async (key, value) => {
    await AppSetting.upsert({ key, value: value == null ? null : String(value) });
};

// Save from the admin form. The password is only written when a non-empty
// value is supplied, so leaving it blank keeps the existing one.
const saveEmailSettings = async (body = {}) => {
    if (body.smtp_host !== undefined) await upsert('smtp_host', body.smtp_host);
    if (body.smtp_port !== undefined) await upsert('smtp_port', body.smtp_port);
    if (body.smtp_user !== undefined) await upsert('smtp_user', body.smtp_user);
    if (body.smtp_from !== undefined) await upsert('smtp_from', body.smtp_from);
    if (body.lms_login_url !== undefined) await upsert('lms_login_url', body.lms_login_url);
    if (body.smtp_pass) await upsert('smtp_pass', body.smtp_pass); // only when provided
    cache = null; // bust so the mailer picks up new config immediately
    return getEmailSettingsMasked();
};

const clearCache = () => { cache = null; };

module.exports = { getEmailConfig, getEmailSettingsMasked, saveEmailSettings, clearCache };
