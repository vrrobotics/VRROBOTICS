/**
 * VR Robotics Academy - Supabase migration applier.
 *
 * Resolves pg + dotenv from backend/admin-service/node_modules so this
 * script can live outside any service while still using their installed
 * dependencies. Run after `npm install` in backend/admin-service.
 *
 * Usage:
 *   node supabase/apply-migrations.js
 *
 * Idempotent: SQL uses CREATE ... IF NOT EXISTS / ON CONFLICT, so safe
 * to re-run.
 */
const fs = require('fs');
const path = require('path');

// ---- Resolve pg + dotenv from admin-service's installed node_modules ----
const ROOT = path.resolve(__dirname, '..');
const ADMIN_NM = path.join(ROOT, 'backend', 'admin-service', 'node_modules');

if (!fs.existsSync(ADMIN_NM)) {
    console.error('ERROR: backend/admin-service/node_modules not found.');
    console.error('Run `npm install` in backend/admin-service first.');
    process.exit(1);
}

let pg, dotenv;
try {
    pg = require(path.join(ADMIN_NM, 'pg'));
    dotenv = require(path.join(ADMIN_NM, 'dotenv'));
} catch (e) {
    console.error('ERROR: could not load pg/dotenv from admin-service:', e.message);
    process.exit(1);
}

dotenv.config({ path: path.join(ROOT, 'backend', 'admin-service', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not found in backend/admin-service/.env');
    process.exit(1);
}

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d+_.+\.sql$/.test(f) && f !== '06_apply_all.sql')
    .sort();

if (files.length === 0) {
    console.error('ERROR: no migration files found in', migrationsDir);
    process.exit(1);
}

(async () => {
    console.log(`Applying ${files.length} migrations to Supabase Postgres...`);
    const client = new pg.Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        statement_timeout: 0,
    });
    try {
        await client.connect();
        for (const f of files) {
            process.stdout.write(`  - ${f.padEnd(40)} `);
            const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
            await client.query(sql);
            console.log('OK');
        }
        const { rows } = await client.query(
            'SELECT COUNT(*)::int AS n FROM lucy_devdb.roles'
        );
        const n = rows[0].n;
        console.log(`\nVerified: lucy_devdb.roles has ${n} row(s) (expected 4).`);
        if (n !== 4) {
            console.warn('WARNING: row count off; rerun or check the SQL output above.');
            process.exit(2);
        }
        console.log('Schema is ready.');
    } catch (err) {
        console.error('\nERROR: migration failed:', err.message);
        if (err.position) console.error('  at position', err.position);
        process.exit(1);
    } finally {
        await client.end();
    }
})();
