// index.js
import 'dotenv/config';
import app from './src/index.js';

// Last-resort guards: the gateway is the single entry point — a stray async
// throw must not silently take it down (that = everything down). Log for
// Sentry/host capture; the host restarts on a real exit.
process.on('unhandledRejection', (reason) => {
  console.error('[bastion] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[bastion] Uncaught exception:', err);
});

// Railway (and most PaaS) inject PORT — bind it first so the platform router can
// reach the gateway. Falls back to SERVICE_PORT / 8000 for local/dev setups.
const PORT = process.env.PORT || process.env.SERVICE_PORT || 8000;

app.listen(PORT, () => {
  console.log(`Bastion Server running on port ${PORT}`);
})
