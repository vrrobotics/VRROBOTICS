// Supabase browser client.
//
// Auth still flows through the backend (auth-service /auth/login etc.) so the
// existing axios-based authApi keeps working unchanged. This client exists
// for:
//   - Direct Supabase features the backend doesn't proxy (password reset
//     emails, magic links, OAuth providers).
//   - Reading the current session client-side without a round-trip when we
//     need it.
//
// NEVER import the service_role key here — that key belongs server-side
// only (admin-service / auth-service). The anon key + RLS is the safe pair
// for browser use.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing. ' +
    'Direct Supabase calls (password reset, OAuth) will fail until both are set.'
  );
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'placeholder', {
  auth: {
    // The backend issues the session via login/refresh endpoints and sets
    // httpOnly cookies, so we don't want this client to persist or auto-
    // refresh in localStorage and drift out of sync.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export default supabase;
