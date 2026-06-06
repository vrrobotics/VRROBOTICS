import app, { initDb } from './src/app.js';

// Last-resort guards: a stray async throw or rejected promise must NOT silently
// kill the auth process (that = login down). Log so Sentry/host capture it; the
// host (Railway) restarts on a real exit, but we keep serving where we can.
process.on('unhandledRejection', (reason) => {
  console.error('[auth-service] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[auth-service] Uncaught exception:', err);
});

const PORT = process.env.PORT || 8001;

initDb().then(async () => {
  app.listen(PORT, () => {
    console.log(`🔐 Auth Service running on port ${PORT}---`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
