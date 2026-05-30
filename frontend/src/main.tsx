import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSentry } from './lib/sentry'

// Initialise error/performance monitoring before the app mounts. No-op
// unless VITE_SENTRY_DSN is set.
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
