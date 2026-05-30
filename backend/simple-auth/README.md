# VR Robotics — Simple Auth Backend

A standalone, self-contained authentication backend + **SQLite** database for the
VR Robotics login/signup UI (`/auth` page in the frontend). No external services,
no cloud account — just Node + a local `.db` file.

## What it provides

REST API under `http://localhost:8000/api/v1` (the URL the frontend already uses):

| Method | Endpoint               | Purpose                                  | Auth |
|--------|------------------------|------------------------------------------|------|
| POST   | `/auth/register`       | Create account (student or instructor)   | —    |
| POST   | `/auth/login`          | Log in, returns tokens + user            | —    |
| GET    | `/auth/profile`        | Current user                             | Bearer |
| POST   | `/auth/refresh`        | New access/refresh tokens                | cookie/body |
| POST   | `/auth/change-password`| Change password                          | Bearer |
| POST   | `/auth/logout`         | Clear cookies                            | —    |
| GET    | `/health`              | Health check                             | —    |

Responses match the frontend contract exactly:
`{ accessToken, refreshToken, user: { userId, email, name, phone, dob, gender, role } }`.

Passwords are stored as **bcrypt** hashes; sessions use **JWT** (access + refresh),
sent both as a `Bearer` token and httpOnly cookies.

## Database

- Engine: **SQLite** via `better-sqlite3` (a single file, created automatically).
- Location: `./data/auth.db` (override with `DB_FILE`).
- Schema (`users` table): `userId, name, email (unique), passwordHash, phone, dob,
  gender, role ('student' | 'instructor'), createdAt`.

## Run it

```powershell
cd "c:\Users\malli\Desktop\Misson Impossible\YagnaTechOrg\backend\simple-auth"
npm install
Copy-Item .env.example .env   # optional; defaults work out of the box
npm start
```

You should see:
```
[db] SQLite ready at ...\data\auth.db
[auth] VR Robotics auth API on http://localhost:8000/api/v1
```

Then start the frontend (`YagnaTechOrg/frontend` → `npm run dev`) and use the
**Sign In** button or **Courses → Teachers**. Sign up creates a row in `auth.db`;
log in returns a token and loads your profile.

## Notes

- The frontend points at `http://localhost:8000` by default
  (`VITE_BASTION_API_URL`). If port 8000 is taken (e.g. by the full Bastion
  gateway), run this on another port (`PORT=8001 npm start`) and set
  `VITE_BASTION_API_URL=http://localhost:8001` in the frontend `.env`.
- This is a lightweight backend for the public login/signup UI. The repo's
  larger `auth-service` (Supabase/Sequelize) and admin flows are separate and
  untouched.
- Change `JWT_SECRET` before any real deployment.

## Quick test (without the UI)

```powershell
# register
curl -X POST http://localhost:8000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"name\":\"Test\",\"email\":\"t@t.com\",\"password\":\"password123\",\"role\":\"instructor\"}"

# login
curl -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"t@t.com\",\"password\":\"password123\"}"
```
