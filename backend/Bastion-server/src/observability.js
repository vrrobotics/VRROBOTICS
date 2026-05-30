// Sentry wiring (ESM). Self-initializing on import, guarded by SENTRY_DSN so
// it's a no-op without a DSN. Import first in the entrypoint for full tracing.
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const enabled = Boolean(dsn);

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    serverName: process.env.SERVICE_NAME || 'bastion',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
  // eslint-disable-next-line no-console
  console.log('[observability] Sentry initialised');
}

export function attachErrorHandler(app) {
  if (enabled) Sentry.setupExpressErrorHandler(app);
}

export { Sentry, enabled as sentryEnabled };
