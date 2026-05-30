import dotenv from "dotenv";
import pg from "pg";
import fs from "node:fs";
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const s = process.env.DB_SCHEMA || "lucy_devdb";
const out = [];
const r = await pool.query(
  `SELECT u.email, ro."role" AS role
   FROM "${s}".users u JOIN "${s}".roles ro ON ro."roleId" = u."roleId"
   WHERE u.email LIKE '%@vrtest.com' ORDER BY u.email`,
);
out.push("STORED ROLE MAPPING:");
for (const x of r.rows) out.push("  " + x.email + " => " + x.role);
const del = await pool.query(`DELETE FROM "${s}".users WHERE email LIKE '%@vrtest.com'`);
out.push("cleaned test profiles: " + del.rowCount);
const c = await pool.query(`SELECT COUNT(*)::int n FROM "${s}".users`);
out.push("real users remaining: " + c.rows[0].n);
fs.writeFileSync("zcheck.txt", out.join("\n"));
await pool.end();
