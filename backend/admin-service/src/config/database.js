const { Sequelize } = require('sequelize');
const env = require('./env');

// Primary admin-service DB handle. Was MySQL (lms_admin) on AWS RDS;
// now Supabase Postgres with schema `lms_admin`. Existing models reference
// snake_case columns (created_at / updated_at) and freezeTableName=true —
// no model code needs to change for the dialect swap.
const dbSchema = env.db.schema || 'lms_admin';

const baseOptions = {
    dialect: 'postgres',
    logging: false,
    schema: dbSchema,
    define: { underscored: false, freezeTableName: true },
    pool: { max: 10, min: 0, acquire: 60000, idle: 10000, evict: 15000 },
    retry: {
        max: 3,
        match: [
            /ECONNRESET/, /ETIMEDOUT/, /EHOSTUNREACH/,
            /SequelizeConnectionError/, /SequelizeConnectionRefusedError/,
            /SequelizeHostNotFoundError/, /SequelizeHostNotReachableError/,
            /SequelizeInvalidConnectionError/, /SequelizeConnectionTimedOutError/,
        ],
    },
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
    },
    // `schema` scopes only model queries; raw SQL (BatchService, StudentService,
    // …) uses unqualified table names that resolve via search_path. Pin it so
    // those raw queries land in lms_admin instead of the default public schema.
    hooks: {
        afterConnect: async (connection) => {
            await connection.query(`SET search_path TO "${dbSchema}", public`);
        },
    },
};

const sequelize = env.db.url
    ? new Sequelize(env.db.url, baseOptions)
    : new Sequelize(env.db.name, env.db.user, env.db.pass, {
          host: env.db.host,
          port: env.db.port,
          ...baseOptions,
      });

module.exports = sequelize;
