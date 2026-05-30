/**
 * VR Robotics Academy - Supabase region auto-detector + .env fixer.
 *
 * Probes each common Supabase pooler region until one accepts our
 * credentials. Then rewrites DATABASE_URL in every .env file under
 * backend/* and frontend/ to use the discovered pooler hostname.
 *
 * Background: Supabase deprecated free IPv4 on the "direct" hostname
 * (db.<ref>.supabase.co) in early 2024. The poolers (session at :5432,
 * transaction at :6543) stay free on IPv4, but the hostname is
 * region-specific: aws-0-<region>.pooler.supabase.com.
 *
 * Run after `npm install` in backend/admin-service (uses its pg + dotenv).
 *
 * Usage:  node supabase/detect-region.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_NM = path.join(ROOT, 'backend', 'admin-service', 'node_modules');
const pg = require(path.join(ADMIN_NM, 'pg'));
const dotenv = require(path.join(ADMIN_NM, 'dotenv'));

dotenv.config({ path: path.join(ROOT, 'backend', 'admin-service', '.env') });

// Pull project ref + password from the existing DATABASE_URL.
const current = process.env.DATABASE_URL || '';
const refFromUrl = (current.match(/db\.([^.]+)\.supabase\.co/) || [])[1]
    || (current.match(/postgres\.([^:]+):/) || [])[1];
const passFromUrl = (current.match(/postgres(?:\.[^:]+)?:([^@]+)@/) || [])[1];

if (!refFromUrl || !passFromUrl) {
    console.error('ERROR: could not parse project ref / password from DATABASE_URL in');
    console.error('  ', path.join(ROOT, 'backend', 'admin-service', '.env'));
    process.exit(1);
}

const PROJECT_REF = refFromUrl;
const PASSWORD_RAW = decodeURIComponent(passFromUrl);
const PASSWORD_ENC = encodeURIComponent(PASSWORD_RAW);

console.log(`Project ref:  ${PROJECT_REF}`);
console.log(`Password:     ${'*'.repeat(PASSWORD_RAW.length)}`);
console.log();

// Common Supabase regions (ordered by popularity / proximity to India first).
const REGIONS = [
    'ap-south-1',         // Mumbai
    'ap-southeast-1',     // Singapore
    'us-east-1',          // N. Virginia
    'us-east-2',          // Ohio
    'us-west-1',          // N. California
    'us-west-2',          // Oregon
    'eu-central-1',       // Frankfurt
    'eu-west-1',          // Ireland
    'eu-west-2',          // London
    'eu-west-3',          // Paris
    'eu-north-1',         // Stockholm
    'ap-northeast-1',     // Tokyo
    'ap-northeast-2',     // Seoul
    'ap-southeast-2',     // Sydney
    'sa-east-1',          // São Paulo
    'ca-central-1',       // Canada
];

async function tryRegion(region) {
    const client = new pg.Client({
        host: `aws-0-${region}.pooler.supabase.com`,
        port: 5432,
        user: `postgres.${PROJECT_REF}`,
        password: PASSWORD_RAW,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 6000,
        query_timeout: 4000,
    });
    try {
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        return { ok: true };
    } catch (err) {
        try { await client.end(); } catch (_) {}
        return { ok: false, error: err.message };
    }
}

(async () => {
    console.log('Probing Supabase pooler regions...\n');
    let found = null;
    for (const region of REGIONS) {
        process.stdout.write(`  - ${region.padEnd(20)} `);
        const { ok, error } = await tryRegion(region);
        if (ok) {
            console.log('CONNECTED');
            found = region;
            break;
        }
        const short = String(error || '').split('\n')[0].slice(0, 60);
        console.log(short);
    }

    if (!found) {
        console.error('\nERROR: no region accepted the credentials.');
        console.error('Double-check the password and project ref, or paste the');
        console.error('connection string from Supabase Dashboard > Connect > Session pooler.');
        process.exit(1);
    }

    console.log(`\nDetected region: ${found}`);

    // Build the new pooler URLs (session for migrations, transaction for runtime).
    const sessionUrl =
        `postgresql://postgres.${PROJECT_REF}:${PASSWORD_ENC}` +
        `@aws-0-${found}.pooler.supabase.com:5432/postgres`;
    const txUrl =
        `postgresql://postgres.${PROJECT_REF}:${PASSWORD_ENC}` +
        `@aws-0-${found}.pooler.supabase.com:6543/postgres`;

    console.log(`Session pooler (5432, for migrations + Sequelize):`);
    console.log(`  ${sessionUrl}`);
    console.log();

    // Update all .env files.
    const envFiles = [
        'backend/auth-service/.env',
        'backend/admin-service/.env',
        'backend/course-service/.env',
        'backend/assessment-service/.env',
        'backend/college-service/.env',
        'backend/organization-service/.env',
        'backend/payment-service/.env',
    ];

    let updated = 0;
    for (const rel of envFiles) {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) {
            console.log(`  - ${rel}  (skipped: missing)`);
            continue;
        }
        const original = fs.readFileSync(abs, 'utf8');
        // Replace any line starting with DATABASE_URL= with the new value.
        const next = original.replace(
            /^DATABASE_URL=.*$/m,
            `DATABASE_URL=${sessionUrl}`
        );
        if (next === original) {
            // No DATABASE_URL line present — append it.
            fs.writeFileSync(abs, original.trimEnd() + `\nDATABASE_URL=${sessionUrl}\n`);
        } else {
            fs.writeFileSync(abs, next);
        }
        updated++;
        console.log(`  - ${rel}  updated`);
    }

    console.log(`\nUpdated DATABASE_URL in ${updated} backend .env file(s).`);
    console.log('Now re-run:  powershell -ExecutionPolicy Bypass -File .\\run.ps1');
})();
