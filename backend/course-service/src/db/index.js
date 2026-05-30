import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const connectionUrl = process.env.DATABASE_URL;
const DB_SCHEMA = process.env.DB_SCHEMA || 'lucy_devdb';

// `schema` only scopes Sequelize MODEL queries. Raw SQL (the enrollment
// college lookup) uses unqualified table names that resolve via the
// connection search_path — default `public`, where these tables don't exist.
// Pin search_path on every new connection so raw queries land in lucy_devdb.
const afterConnect = async (connection) => {
  await connection.query(`SET search_path TO "${DB_SCHEMA}", public`);
};

const sequelize = connectionUrl
  ? new Sequelize(connectionUrl, {
      dialect: 'postgres',
      logging: false,
      schema: DB_SCHEMA,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      hooks: { afterConnect },
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASS,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,
        schema: DB_SCHEMA,
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        hooks: { afterConnect },
      }
    );

export default sequelize;
