import './loadEnv.js';
import './observability.js'; // Sentry.init() — keep first
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { Sequelize } from 'sequelize';
import sequelize from './db/index.js';
import cookieParser from "cookie-parser";
import courseRoutes from './routes/course.routes.js';
import enrollRoutes from './routes/enroll.routes.js';
import { attachErrorHandler } from './observability.js';

const app = express();

app.use(cors({ 
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true, // allow cookies
}));

app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: process.env.SERVICE_NAME });
});

app.get("/", (req, res) => {
  res.send("Welcome to the Course Service API");
});

app.use('/', courseRoutes);
app.use('/enroll', enrollRoutes);

export async function initDb() {
  // On Supabase Postgres the database already exists (`postgres`) and the
  // role has no CREATE DATABASE privilege, so the old MySQL bootstrap
  // (CREATE DATABASE IF NOT EXISTS) is gone. The schema (lucy_devdb) and
  // tables are provisioned by supabase/migrations/*.sql; sync() below is a
  // dev convenience to create any model table still missing in that schema.
  await sequelize.authenticate();
  await sequelize.sync();

  // sequelize.sync() creates missing tables but does NOT add new columns
  // to existing ones, so columns added to a model after the table already
  // exists in a dev DB (e.g. instructorId on courses) need an explicit
  // ALTER. We do it idempotently here so restarting the service is enough
  // — no separate migration step required in dev. The migrations folder
  // is still the source of truth for prod.
  try {
    const qi = sequelize.getQueryInterface();
    const courses = await qi.describeTable('courses');
    if (!courses.instructorId) {
      await qi.addColumn('courses', 'instructorId', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      console.log("🛠️  Added courses.instructorId column");
    }
  } catch (err) {
    console.warn('[db] auto column-add check failed:', err.message);
  }

  console.log('🗄️  Database connected and synced---');
}

attachErrorHandler(app);

export default app;