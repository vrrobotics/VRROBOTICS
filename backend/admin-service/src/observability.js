// Sentry wiring (CommonJS). Self-initializing on require — guarded by
// SENTRY_DSN so local dev / CI without a DSN is a complete no-op.
//
// For full Express auto-instrumentation, require this module first in the
// service entrypoint (src/server.js):  require('./observability');
// Error capture via setupExpressErrorHandler works regardless of order.
const Sentry = require('@sentry/node');

const dsn = process.env.SENTRY_DSN;
const enabled = Boolean(dsn);

if (enabled) {
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.SENTRY_RELEASE || undefined,
        serverName: process.env.SERVICE_NAME || 'admin-service',
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    });
    console.log('[observability] Sentry initialised');
}

function attachErrorHandler(app) {
    if (enabled) Sentry.setupExpressErrorHandler(app);
}

module.exports = { Sentry, sentryEnabled: enabled, attachErrorHandler };
