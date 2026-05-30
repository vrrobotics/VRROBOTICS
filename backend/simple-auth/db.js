// Supabase Postgres connection (no local DB). Uses the `pg` driver — pure JS,
// no native build. The table is created in your Supabase project so rows are
// visible in the Supabase SQL editor / Table editor.
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add your Supabase connection string to .env");
}

// Supabase requires SSL. The pooler presents a cert chain Node may not have a
// local root for, so we don't reject unauthorized (standard for Supabase pooler).
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// Table name is namespaced so it never collides with the main LMS `Users` table.
export const USERS_TABLE = "vr_auth_users";

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
      user_id       text PRIMARY KEY,
      name          text NOT NULL,
      email         text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      phone         text,
      dob           text,
      gender        text,
      role          text NOT NULL DEFAULT 'student',
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${USERS_TABLE}`);
  console.log(`[db] Supabase Postgres ready — table "${USERS_TABLE}" (${rows[0].n} rows)`);
}

export default pool;
