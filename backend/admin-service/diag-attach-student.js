// One-shot: attach a single student to a college so we can verify the
// College Admin dashboard end-to-end without waiting for the profile UI flow.
//
// Usage:
//   node diag-attach-student.js <email> <clgId>
//   node diag-attach-student.js test@gmail.com COLLEGE001
//
// Effect:
//   UPDATE lucy_devdb.users SET collegeId='<clgId>' WHERE email='<email>'
//
// After running, log in to /admin/college as the matching college admin and
// click Refresh — the KPIs should update.

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const [, , email, clgId] = process.argv;
if (!email || !clgId) {
    console.error('Usage: node diag-attach-student.js <email> <clgId>');
    process.exit(1);
}

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
        const before = await authDb.query(
            `SELECT "userId", email, "collegeId", "preScore", "postScore" FROM users WHERE email = :email`,
            { replacements: { email }, type: QueryTypes.SELECT }
        );
        if (!before.length) {
            console.error(`No user with email ${email}`);
            process.exit(2);
        }
        console.log('Before:', before[0]);

        const updated = await authDb.query(
            `UPDATE users SET "collegeId" = :clgId WHERE email = :email RETURNING "userId"`,
            { replacements: { email, clgId }, type: QueryTypes.SELECT }
        );

        const after = await authDb.query(
            `SELECT "userId", email, "collegeId", "preScore", "postScore" FROM users WHERE email = :email`,
            { replacements: { email }, type: QueryTypes.SELECT }
        );
        console.log(`Rows updated: ${updated.length}`);
        console.log('After: ', after[0]);
    } finally {
        await authDb.close();
    }
})();
