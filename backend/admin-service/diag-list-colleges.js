// Throwaway: list colleges & branches that the dropdown would show.
require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const authDb = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
          dialect: 'postgres', logging: false,
          schema: process.env.AUTH_DB_SCHEMA || 'lucy_devdb',
          dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      })
    : new Sequelize(process.env.AUTH_DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
          host: process.env.DB_HOST, port: process.env.DB_PORT, dialect: 'postgres', logging: false,
          schema: process.env.AUTH_DB_SCHEMA || 'lucy_devdb',
          dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      });

(async () => {
    try {
        const colleges = await authDb.query(
            `SELECT "clgId", "clgName", accesskey FROM lucy_devdb.colleges ORDER BY "clgId"`,
            { type: QueryTypes.SELECT }
        );
        console.log(`\n=== colleges (${colleges.length}) ===`);
        colleges.forEach((c) => console.log(`  ${c.clgId.padEnd(20)} ${c.clgName}`));

        const branches = await authDb.query(
            `SELECT "branchId", "branchName" FROM lucy_devdb.branches ORDER BY "branchId"`,
            { type: QueryTypes.SELECT }
        );
        console.log(`\n=== branches (${branches.length}) ===`);
        branches.forEach((b) => console.log(`  ${b.branchId.padEnd(20)} ${b.branchName}`));

        // Both schemas live in the same Supabase Postgres DB, so a single
        // schema-qualified query reaches lms_admin.users directly.
        const adminCollegeIds = await authDb.query(
            `SELECT DISTINCT college_id FROM lms_admin.users WHERE role IN ('admin','root') AND college_id IS NOT NULL`,
            { type: QueryTypes.SELECT }
        ).catch(() => []);
        console.log(`\n=== admin college_ids in lms_admin (for cross-check) ===`);
        adminCollegeIds.forEach((r) => console.log(`  ${r.college_id}`));
    } finally {
        await authDb.close();
    }
})();
