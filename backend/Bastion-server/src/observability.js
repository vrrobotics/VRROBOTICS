// Sentry wiring (ESM). Self-initializing on import, guarded by SENTRY_DSN so
// it's a no-op without a DSN. Import first in the entrypoint for full tracing.
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const enabled = Boolean(dsn);

// Idempotent: started via `--import ./instrument.mjs` (prod) Sentry is ALREADY
// initialised (full tracing) → skip. Plain `node index.js` (local) → init here
// as a fallback so error capture still works.
if (enabled && !Sentry.getClient()) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    serverName: process.env.SERVICE_NAME || 'bastion',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
  // eslint-disable-next-line no-console
  console.log('[observability] Sentry initialised (fallback)');
}

export function attachErrorHandler(app) {
  if (enabled) Sentry.setupExpressErrorHandler(app);
}

export { Sentry, enabled as sentryEnabled };
