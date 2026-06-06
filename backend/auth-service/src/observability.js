// Lightweight Sentry wiring (ESM). Self-initializing on import — guarded by
// SENTRY_DSN so local dev / CI without a DSN is a complete no-op.
//
// For FULL performance tracing (auto Express instrumentation), Sentry v8
// wants init() to run before `express` is imported. To get that, import this
// module as the very FIRST line of the service entrypoint (index.js):
//     import './src/observability.js';
// Error capture via setupExpressErrorHandler works regardless of import order.
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const enabled = Boolean(dsn);

// Idempotent: started via `--import ./instrument.mjs` (prod) Sentry is ALREADY
// initialised (full tracing) → don't double-init. Started as plain `node
// index.js` (local dev) instrument.mjs didn't run → init here as a fallback so
// error capture still works (only auto-tracing is degraded).
if (enabled && !Sentry.getClient()) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    serverName: process.env.SERVICE_NAME || undefined,
    // Keep traces cheap by default; bump via env in staging/prod.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
  // eslint-disable-next-line no-console
  console.log('[observability] Sentry initialised (fallback)');
}

// Attach the Express error handler AFTER all routes are registered.
export function attachErrorHandler(app) {
  if (enabled) Sentry.setupExpressErrorHandler(app);
}

export { Sentry, enabled as sentryEnabled };
