const nodemailer = require('nodemailer');
const { getEmailConfig } = require('../services/SettingsService');

// Transport is rebuilt whenever the effective SMTP config changes (admin edits
// it from the dashboard), keyed on host|port|user|pass. Config comes from
// SettingsService (DB-first, .env fallback).
let transport = null;
let transportKey = '';
const keyOf = (c) => `${c.host}|${c.port}|${c.user}|${c.pass}`;

const getTransport = async () => {
    const cfg = await getEmailConfig();
    if (!cfg.host) return { t: null, cfg };
    const key = keyOf(cfg);
    if (!transport || key !== transportKey) {
        transport = nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            // 465 = implicit TLS; 587/others = STARTTLS. Brevo/Gmail/SES use 587.
            secure: Number(cfg.port) === 465,
            auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
        });
        transportKey = key;
    }
    return { t: transport, cfg };
};

// Throws on transport / SMTP errors so the queue worker can record them.
// Returns { skipped: true } when SMTP isn't configured (no host) so optional
// callers (live-class notifier) stay no-ops in dev.
const send = async ({ to, subject, html, from }) => {
    const { t, cfg } = await getTransport();
    if (!t) return { skipped: true };
    const info = await t.sendMail({ from: from || cfg.from, to, subject, html });
    return { messageId: info.messageId, response: info.response };
};

// Async now (config may live in the DB). Callers await before draining/sending.
const isConfigured = async () => {
    const cfg = await getEmailConfig();
    return Boolean(cfg.host);
};

module.exports = { send, isConfigured };
