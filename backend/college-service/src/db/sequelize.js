import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const connectionUrl = process.env.DATABASE_URL;

const sequelize = connectionUrl
  ? new Sequelize(connectionUrl, {
      dialect: 'postgres',
      logging: false,
      schema: process.env.DB_SCHEMA || 'lucy_devdb',
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
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
        schema: process.env.DB_SCHEMA || 'lucy_devdb',
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      }
    );

export default sequelize;
