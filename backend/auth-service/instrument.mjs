// Sentry instrumentation — loaded via `node --import ./instrument.mjs index.js`
// so Sentry.init() runs BEFORE any application module (incl. express) is
// imported. In ESM this is the ONLY way to get full auto-instrumentation
// (request tracing); importing it "first" inside the app still loses the race
// because static imports are hoisted. Guarded by SENTRY_DSN → no-op without it.
import 'dotenv/config';
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    serverName: process.env.SERVICE_NAME || 'auth-service',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
  console.log('[observability] Sentry initialised (instrument)');
}
