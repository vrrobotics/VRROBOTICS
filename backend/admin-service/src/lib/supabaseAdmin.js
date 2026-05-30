const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');

// Server-side Supabase admin client. The service_role key bypasses RLS,
// so this client is for admin-service operations only — NEVER expose
// either the client or the key to the browser.
//
// Used today by StudentService / InstructorService to create login-able
// auth users for admin-added students and instructors.

if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    console.warn(
        '[supabaseAdmin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. ' +
        'Admin user-create flows will fail until both are set in admin-service/.env.'
    );
}

const supabaseAdmin = createClient(
    env.supabase.url || 'http://localhost',
    env.supabase.serviceRoleKey || 'placeholder',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

module.exports = supabaseAdmin;
