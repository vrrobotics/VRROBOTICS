/**
 * VR Robotics Academy - quick DB inspector.
 * Lists every table in lucy_devdb / lms_admin / public with its row count,
 * so we can see what data exists and in which schema.
 *   node supabase/inspect-data.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_NM = path.join(ROOT, 'backend', 'admin-service', 'node_modules');
const pg = require(path.join(ADMIN_NM, 'pg'));
const dotenv = require(path.join(ADMIN_NM, 'dotenv'));
dotenv.config({ path: path.join(ROOT, 'backend', 'admin-service', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

(async () => {
    const client = new pg.Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        statement_timeout: 0,
    });
    await client.connect();

    // Which DB / host are we actually pointed at?
    const { rows: who } = await client.query(
        `select current_database() as db, inet_server_addr()::text as host`
    );
    console.log(`Connected to db=${who[0].db} host=${who[0].host || 'pooler'}`);

    const schemas = ['lucy_devdb', 'lms_admin', 'public'];
    for (const schema of schemas) {
        const { rows: tables } = await client.query(
            `select table_name from information_schema.tables
              where table_schema = $1 and table_type = 'BASE TABLE'
              order by table_name`,
            [schema]
        );
        console.log(`\n=== schema ${schema} (${tables.length} tables) ===`);
        for (const t of tables) {
            const q = `select count(*)::int as n from "${schema}"."${t.table_name}"`;
            try {
                const { rows } = await client.query(q);
                console.log(`  ${t.table_name.padEnd(34)} ${rows[0].n}`);
            } catch (e) {
                console.log(`  ${t.table_name.padEnd(34)} ERR ${e.message}`);
            }
        }
    }

    await client.end();
})().catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
});
