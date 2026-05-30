const { Sequelize } = require('sequelize');
const env = require('./env');

/**
 * Second Sequelize handle pointed at the auth schema (`lucy_devdb`).
 * Used by:
 *   - College Dashboard endpoint (aggregate counts)
 *   - StudentService (program_requests + cross-schema user joins)
 *
 * Same physical Supabase Postgres DB as the primary handle — just a
 * different `schema` value so models default to `lucy_devdb.*`.
 */
const authSchema = env.authDb.schema || 'lucy_devdb';

const baseOptions = {
    dialect: 'postgres',
    logging: false,
    schema: authSchema,
    define: { underscored: false, freezeTableName: true },
    pool: { max: 5, min: 0, acquire: 60000, idle: 10000 },
    retry: {
        max: 2,
        match: [/ECONNRESET/, /ETIMEDOUT/, /SequelizeConnectionError/],
    },
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
    },
    // `schema` above only scopes Sequelize MODEL queries. The raw SQL in
    // TeacherService / StudentService / dashboard aggregates uses
    // unqualified table names (`users`, `roles`, …), which resolve via the
    // connection search_path — default `public`, where these tables don't
    // exist ("relation \"users\" does not exist"). Pin search_path on every
    // new pooled connection so raw queries land in lucy_devdb. Session pooler
    // (port 5432) keeps this for the connection's lifetime.
    hooks: {
        afterConnect: async (connection) => {
            await connection.query(`SET search_path TO "${authSchema}", public`);
        },
    },
};

const authSequelize = env.authDb.url
    ? new Sequelize(env.authDb.url, baseOptions)
    : new Sequelize(env.authDb.name, env.authDb.user, env.authDb.pass, {
          host: env.authDb.host,
          port: env.authDb.port,
          ...baseOptions,
      });

module.exports = authSequelize;
