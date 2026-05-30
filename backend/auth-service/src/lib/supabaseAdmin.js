import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.warn(
    '[supabaseAdmin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. ' +
    'Auth endpoints will fail until both are set in auth-service/.env.'
  );
}

// Server-side admin client. NEVER expose the service_role key to the
// frontend — this client bypasses Row-Level Security and can create / read /
// delete any user in Supabase Auth.
const supabaseAdmin = createClient(
  url || 'http://localhost',
  serviceRoleKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabaseAdmin;
