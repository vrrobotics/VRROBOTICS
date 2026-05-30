import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[supabaseAnon] SUPABASE_URL or SUPABASE_ANON_KEY missing. ' +
    'Login/refresh endpoints will fail until both are set.'
  );
}

// Anon-key client. Used for password sign-in (signInWithPassword) and
// session refresh — both flows that should respect RLS and rate limits.
const supabaseAnon = createClient(
  url || 'http://localhost',
  anonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabaseAnon;
