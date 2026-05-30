import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import pool, { initDb, USERS_TABLE } from "./db.js";

const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "1h";
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL || "7d";
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:8080")
  .split(",")
  .map((s) => s.trim());

const PUBLIC_ROLES = ["student", "teacher"];

const app = express();
// The frontend base URL can include a trailing slash → "//api/v1/...". Collapse.
app.use((req, _res, next) => {
  req.url = req.url.replace(/\/{2,}/g, "/");
  next();
});
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// ── helpers ────────────────────────────────────────────────
const shapeUser = (u) => ({
  userId: u.user_id,
  email: u.email,
  name: u.name,
  phone: u.phone,
  dob: u.dob,
  gender: u.gender,
  role: u.role,
});

const signTokens = (userId) => ({
  accessToken: jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TTL }),
  refreshToken: jwt.sign({ sub: userId, t: "refresh" }, JWT_SECRET, { expiresIn: REFRESH_TTL }),
});

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const isProd = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, secure: isProd, sameSite: isProd ? "none" : "lax", path: "/" };
  res.cookie("accessToken", accessToken, { ...opts, maxAge: 60 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { ...opts, maxAge: 7 * 24 * 60 * 60 * 1000 });
};

const findByEmail = async (email) =>
  (await pool.query(`SELECT * FROM ${USERS_TABLE} WHERE email = $1`, [email])).rows[0];
const findById = async (userId) =>
  (await pool.query(`SELECT * FROM ${USERS_TABLE} WHERE user_id = $1`, [userId])).rows[0];

// Auth middleware: accepts Bearer header or accessToken cookie.
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.cookies?.accessToken;
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ── routes (mounted under /api/v1 to match the frontend) ───
const router = express.Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone, dob, gender, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    const normEmail = String(email).trim().toLowerCase();
    if (await findByEmail(normEmail)) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const requestedRole = PUBLIC_ROLES.includes(role) ? role : "student";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await pool.query(
      `INSERT INTO ${USERS_TABLE}
         (user_id, name, email, password_hash, phone, dob, gender, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, String(name).trim(), normEmail, passwordHash, phone || null, dob || null, gender || null, requestedRole],
    );

    const user = await findById(userId);
    const tokens = signTokens(userId);
    setAuthCookies(res, tokens);
    return res.status(201).json({ ...tokens, user: shapeUser(user) });
  } catch (err) {
    console.error("[register]", err);
    return res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }
    const user = await findByEmail(String(email).trim().toLowerCase());
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const tokens = signTokens(user.user_id);
    setAuthCookies(res, tokens);
    return res.json({ ...tokens, user: shapeUser(user) });
  } catch (err) {
    console.error("[login]", err);
    return res.status(500).json({ message: "Login failed" });
  }
});

router.get("/auth/profile", requireAuth, async (req, res) => {
  const user = await findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json(shapeUser(user));
});

router.post("/auth/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return res.status(401).json({ message: "No refresh token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findById(payload.sub);
    if (!user) return res.status(401).json({ message: "User not found" });
    const tokens = signTokens(user.user_id);
    setAuthCookies(res, tokens);
    return res.json({ ...tokens, user: shapeUser(user) });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = await findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!(await bcrypt.compare(currentPassword || "", user.password_hash))) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }
  if (String(newPassword || "").length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query(`UPDATE ${USERS_TABLE} SET password_hash = $1 WHERE user_id = $2`, [
    passwordHash,
    user.user_id,
  ]);
  return res.json({ message: "Password updated" });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
  return res.json({ message: "Logged out" });
});

app.use("/api/v1", router);

// Bootstrap: ensure the Supabase table exists, then listen.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[auth] VR Robotics auth API on http://localhost:${PORT}/api/v1`);
      console.log(`[auth] Storage: Supabase Postgres (table ${USERS_TABLE})`);
      console.log(`[auth] CORS allowed origins: ${CORS_ORIGIN.join(", ")}`);
    });
  })
  .catch((err) => {
    console.error("[db] Failed to connect to Supabase Postgres:", err.message);
    process.exit(1);
  });
