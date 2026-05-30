# YagnaTech LMS — Database Architecture Documentation

> **Reverse-engineered from the live MySQL schema (lucy-devdb.cu1kcwwqaaqb.us-east-1.rds.amazonaws.com), all Sequelize models across 7 backend services, every raw SQL query (76 occurrences across 21 files), all migration and seeder scripts, and the admin-service boot-time schema patcher. Where the code and the live schema disagree, the live schema is treated as the source of truth and the discrepancy is flagged.**

---

## Executive Summary

The YagnaTech Learning Management System is a Node.js microservices platform composed of **seven backend services** sharing **two physical MySQL databases** on a single AWS RDS instance. There is **no canonical migration history** — schema evolution happens through a combination of (a) ad-hoc `sequelize.sync()` calls, (b) idempotent `ALTER TABLE` blocks in `admin-service/server.js` boot, and (c) a small set of hand-written migration scripts that were never wired into a CLI runner. The schema is partially normalized, with intentional cross-database denormalization where services need to read across boundaries (no foreign keys cross the database boundary).

**Key facts at a glance:**

| Metric | Value |
|---|---|
| Backend services | 7 (+ 1 gateway) |
| Physical databases | 2 (`lucy_devdb`, `lms_admin`) |
| Database engine | MySQL 8.x (AWS RDS, single instance) |
| Total tables | 32 (lucy_devdb: 13, lms_admin: 19) |
| Total Sequelize models defined | ~33 across services |
| Tables created via `sync()` only (no migration) | ~30 |
| Hand-written migration files | 3 |
| Idempotent boot-time `ALTER TABLE` blocks | 9 (all in admin-service/server.js) |
| Cross-DB references (logical FK, no DB enforcement) | 8+ |
| Raw SQL `query()` call sites | 76 across 21 files |

**Notable architectural patterns:**

- **Dual-database, single-instance:** Both schemas live on the same RDS host. Cross-database joins work via three-part naming (`lms_admin.users`, `lucy_devdb.colleges`) but the codebase **never uses cross-database joins** — instead it does separate queries and joins in JavaScript.
- **Two parallel `users` tables:** `lucy_devdb.users` (PK `userId VARCHAR`) and `lms_admin.users` (PK `id INTEGER`). These represent different populations (students/teachers vs. admins) with **no constraint** keeping them consistent.
- **Schema duplication across services:** `College`, `Branch`, and `Organization` are defined three times (in `college-service`, `payment-service`, and admin-service's `assertOrgExists` raw SQL). All three definitions resolve to the same physical table — duplication is a maintenance hazard.
- **Boot-time DDL:** `admin-service/server.js` runs 9 `DESCRIBE` + conditional `ALTER TABLE` blocks every startup. This is how schema changes have historically reached production without a migration runner. Schema diverges between dev and prod whenever an admin-service restart is skipped.

---

# 1. Database Overview

## 1.1 Inventory

| Database | Engine | Host | Owner Service(s) | Purpose |
|---|---|---|---|---|
| `lucy_devdb` | MySQL 8.x | AWS RDS (us-east-1) | auth-service (primary), assessment-service, course-service, college-service, organization-service, payment-service, admin-service (read) | Identity, authentication, college/organization master data, pre-assessment registrations, enrollments, program-request workflow |
| `lms_admin` | MySQL 8.x | Same RDS host | admin-service (primary) | LMS content (courses, lessons, sections, quizzes), admin user accounts, certificates, batches, programs, forums, learner progress |

Both databases share the same MySQL instance, user credentials, port (3306), and connection pool configuration template, but are distinct logical databases (different `DB_NAME` value in each service's `.env`).

## 1.2 Service → Database Mapping

| Service | DB_NAME | AUTH_DB_NAME | ASSESSMENT_DB_NAME | Notes |
|---|---|---|---|---|
| `auth-service` | `lucy_devdb` | — | — | Owns User / Role. JWT issuer. |
| `assessment-service` | `lucy_devdb` | — | — | Owns Assessment, Question, QuestionSet, PreAssessmentRegistration — all in `lucy_devdb`. **Despite the service name, has no separate DB.** |
| `college-service` | `lucy_devdb` | — | — | Owns College, Branch — both in `lucy_devdb`. |
| `course-service` | `lucy_devdb` | — | — | Owns Course (`lucy_devdb.courses`), Enrollment (`lucy_devdb.enrollments`). **Note: `lucy_devdb.courses` is distinct from `lms_admin.courses` — different shape, different PK.** |
| `organization-service` | `lucy_devdb` | — | — | Owns Organisation. |
| `payment-service` | `lucy_devdb` | — | — | Defines duplicate College and Branch models pointing at the same tables college-service owns. No payment-specific tables found. |
| `admin-service` | `lms_admin` | `lucy_devdb` | `lucy_devdb` | Owns 19 tables. Holds read-only handles to `lucy_devdb` (`authDb`) and `lucy_devdb` again (`assessmentDb` — same DB, different handle, separate pool). |
| `Bastion-server` | — | — | — | API gateway. No DB access of its own. |

## 1.3 Connection Architecture

```
                         AWS RDS MySQL 8.x
                  (lucy-devdb.cu1kcwwqaaqb.us-east-1.rds.amazonaws.com:3306)
                         │
        ┌────────────────┼────────────────────┐
        │                                     │
   ── lucy_devdb ──                      ── lms_admin ──
        │                                     │
        ├── auth-service  (Sequelize, pool=10)
        ├── assessment-service  (Sequelize, pool default)
        ├── college-service  (Sequelize, pool default)
        ├── course-service  (Sequelize, pool default)
        ├── organization-service  (Sequelize, pool default)
        ├── payment-service  (Sequelize, pool default)
        │
        └── admin-service connects to BOTH:
              • lms_admin    via `sequelize`     (pool=10, retry policy)
              • lucy_devdb   via `authDb`        (pool=5,  read-only intent)
              • lucy_devdb   via `assessmentDb`  (pool default, separate handle)
```

Three logical connection handles inside admin-service all target the same RDS instance with the same credentials; only the default `database` name differs (or matches, in the case of `authDb` and `assessmentDb`).

## 1.4 Multi-Tenancy

There is **no row-level multi-tenancy** (no `tenant_id` column, no shared partitioning key). What looks like multi-tenancy is actually **college-scoped data**:

- `users.collegeId` (in `lucy_devdb.users`) ties a student to a college.
- `lms_admin.users.college_id` ties an admin to a college.
- `clg_ids` / `clgIds` JSON arrays on `courses`, `categories`, `programs`, `assessments` scope content to one or many colleges.
- The College Dashboard derives a `req.user.college_id` claim from the JWT and uses it to filter every query.

This is application-layer scoping — the database does not enforce it. A bug in any one query can leak data across colleges.

---

# 2. Database Configuration Analysis

## 2.1 Connection Files

| Service | File | Notes |
|---|---|---|
| `auth-service` | `src/db/index.js` | Single Sequelize instance, `dialect: 'mysql'`, retry policy with named error classes (ECONNRESET/ETIMEDOUT/etc.), pool max 10. |
| `assessment-service` | `src/db/index.js` | Bare-bones Sequelize, no retry policy, no pool tuning. |
| `college-service` | `src/db/sequelize.js` | Same shape as assessment-service. |
| `course-service` | `src/db/index.js` | Same shape. |
| `organization-service` | `src/db/index.js` | Same shape. |
| `payment-service` | `src/db/sequelize.js` | Same shape. |
| `admin-service` | `src/config/database.js` (main), `src/config/authDatabase.js` (read-only auth-DB handle), `src/config/assessmentDatabase.js` (read-only handle, same DB as authDb) | Most defensive config: pool max 10, retry max 3, enableKeepAlive, evict 15s. |

**Inconsistency:** Only `auth-service` and `admin-service` apply retry policies and pool tuning. Other services run with Sequelize defaults — under transient RDS connection blips they will fail the request rather than retry.

## 2.2 Environment Variables

```ini
# Shared across all services
DB_HOST=lucy-devdb.cu1kcwwqaaqb.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=SimaxLMSAdmin
DB_PASS=<secret>
DB_DIALECT=mysql           # not used by all services; some hardcode dialect

# Per-service
DB_NAME=lucy_devdb         # all services except admin-service
DB_NAME=lms_admin          # admin-service only
AUTH_DB_NAME=lucy_devdb    # admin-service only
ASSESSMENT_DB_NAME=lucy_devdb  # admin-service only
```

## 2.3 Pooling Configuration

Effective pool sizes:

| Service / Handle | max | min | acquire | idle | evict |
|---|---|---|---|---|---|
| `auth-service` | 10 | 0 | 60s | 10s | 15s |
| `admin-service` (main) | 10 | 0 | 60s | 10s | 15s |
| `admin-service` (authDb) | 5 | 0 | 60s | 10s | — |
| `admin-service` (assessmentDb) | default | default | default | default | default |
| `assessment-service` | default | default | default | default | default |
| `college-service` | default | default | default | default | default |
| `course-service` | default | default | default | default | default |
| `organization-service` | default | default | default | default | default |
| `payment-service` | default | default | default | default | default |

Sequelize defaults are `max=5, min=0, acquire=60000, idle=10000`. Total concurrent DB connections under full load is therefore **~10 (auth) + 15 (admin) + 5×5 (others)** = up to **~50 connections** against the single RDS instance.

## 2.4 ORM Configuration

- ORM: **Sequelize 6.x** (CJS in admin-service, ESM in every other service).
- `logging: false` everywhere — no SQL log capture in production.
- No global `define.underscored` setting at the service level — each model decides its own casing convention, hence the live schema's mixed conventions (`camelCase` in lucy_devdb, `snake_case` in lms_admin).
- `admin-service` sets `define: { underscored: false, freezeTableName: true }` so model names aren't pluralized.
- `define.timestamps` defaults to true except where explicitly turned off (`Role`, `Branch`).

## 2.5 Migration Configuration

There is **no migration framework configured.** No `sequelize-cli` config (`.sequelizerc` does not exist), no Knex, no Liquibase, no Flyway. The three `.js` migration files that exist (`auth-service` and `course-service`) are written in `sequelize-cli` format but the CLI is not a project dependency. They are **never executed automatically** — the column changes those migrations describe were realized via either `sequelize.sync()` on a fresh DB or the boot-time `ALTER TABLE` blocks in admin-service.

## 2.6 Seed Configuration

Three seeder scripts exist (admin-service and auth-service), all are single-purpose shell scripts you run manually:

```
admin-service/src/scripts/seedRootAdmin.js
admin-service/src/scripts/seedCollegeAdmin.js
auth-service/src/scripts/seedAdmin.js
auth-service/src/scripts/seedCollegeAdmin.js
```

There is **no auto-seed on first boot**. Fresh deployments must be seeded by hand.

---

# 3. Tables Overview

## 3.1 Total Tables

**32 tables** across 2 databases (live count from `information_schema`):
- `lucy_devdb`: 13 tables
- `lms_admin`: 19 tables

## 3.2 Full Inventory

### `lucy_devdb` (13 tables)
`assessments`, `branches`, `certificates`, `colleges`, `courses`, `enrollments`, `organisations`, `pre_assessment_registrations`, `program_requests`, `questions`, `questionsets`, `roles`, `settings`, `users`

### `lms_admin` (19 tables)
`batch_members`, `batches`, `categories`, `certificates`, `coupons`, `courses`, `forum_reports`, `forums`, `languages`, `lesson_completions`, `lesson_watch_progress`, `lessons`, `live_classes`, `pre_assessment_results`, `programs`, `questions`, `quiz_submissions`, `sections`, `seo_fields`, `settings`, `user_progress`, `users`

## 3.3 Categorization

### Authentication & Identity (3 tables)
- `lucy_devdb.users` — students, teachers, auditors (PK = string `userId`)
- `lucy_devdb.roles` — role lookup
- `lms_admin.users` — admin user accounts (PK = INTEGER `id`)

### Core Business — Course Content (8 tables, all `lms_admin`)
- `categories`, `courses`, `sections`, `lessons`, `questions`, `quiz_submissions`, `live_classes`, `seo_fields`

### Core Business — Course Content (alternate, `lucy_devdb`, 1 table)
- `lucy_devdb.courses` — **parallel courses table** owned by course-service, distinct from `lms_admin.courses`. Different PK type (string vs INTEGER), different columns. Probably leftover from an earlier monolith split.

### Programs & Curriculum (2 tables)
- `lms_admin.programs`
- `lms_admin.batches`, `lms_admin.batch_members`

### Enrollment & Learner Progress (5 tables)
- `lucy_devdb.enrollments` (string PK, course-service)
- `lms_admin.user_progress` (BIGINT user_id, admin-service)
- `lms_admin.lesson_completions`
- `lms_admin.lesson_watch_progress`
- `lms_admin.certificates`
- `lucy_devdb.certificates` — **unused duplicate**, 0 rows, no code references

### Assessments (4 tables)
- `lucy_devdb.assessments`
- `lucy_devdb.questions` (general question pool)
- `lucy_devdb.questionsets`
- `lucy_devdb.pre_assessment_registrations`
- `lms_admin.pre_assessment_results`

### Organizational Master Data (3 tables)
- `lucy_devdb.organisations`
- `lucy_devdb.colleges`
- `lucy_devdb.branches`

### Workflow & Communication (3 tables)
- `lucy_devdb.program_requests` — admin sends student a program offer; student accepts/rejects
- `lms_admin.forums`
- `lms_admin.forum_reports`

### Commerce / Discount (1 table)
- `lms_admin.coupons`

### Configuration / Settings (3 tables)
- `lms_admin.settings`
- `lms_admin.languages`
- `lucy_devdb.settings` — **unused duplicate**, 0 rows

### Mapping / Junction Tables (1 strict + 4 JSON-as-junction)
- Strict junction: `lms_admin.batch_members`
- JSON-as-junction (denormalized M:N stored in JSON arrays):
  - `lms_admin.courses.clg_ids`, `lms_admin.courses.teacher_ids`
  - `lms_admin.categories.clg_ids`
  - `lms_admin.programs.clg_ids`, `programs.course_ids`
  - `lucy_devdb.assessments.clgIds`, `assessments.courseIds`
  - `lucy_devdb.colleges.branchIds`
  - `lucy_devdb.courses.clgIds`

### Audit / Log Tables
**None.** There is no dedicated audit log. Some tables capture submission metadata (`pre_assessment_registrations.submittedFromIp`, `submittedUserAgent`) but no general audit trail exists.

### Temporary / Cache Tables
**None.** An in-memory `watchStore` (in `admin-service/src/course-content/watchStore.js`) caches lesson completion state and is hydrated from `lesson_completions` + `lesson_watch_progress` on boot. It is not persisted as its own table.

---

# 4. Complete Table Documentation

> **Notation:** "Sequelize model" rows reference the file in the codebase that defines the model. "Used by" lists service(s) that read/write the table. Row counts are estimates from `information_schema.tables.TABLE_ROWS`.

---

## 4.1 Tables in `lucy_devdb`

### 4.1.1 `users` (rows≈23)

**Purpose:** Canonical identity table for **students, teachers, and (when seeded by `auth-service/seedCollegeAdmin.js`) admin** users. Issued and managed by `auth-service`. The PK is a 11-digit numeric string (`generateUserID()`), not an integer.

**Used by:** auth-service (owner), course-service (logical reference via `enrollments.userId`), admin-service (read-only via `authDb`), assessment-service (logical reference via `pre_assessment_registrations.userId`).

**Sequelize model:** `auth-service/src/db/models/User.js`

| Column | Type | Null | Default | Constraint | Notes |
|---|---|---|---|---|---|
| `userId` | VARCHAR(255) | NO | — | PK | 11-digit numeric string, generated by `utils/uidGeneration.generateUserID()`. |
| `name` | VARCHAR(255) | NO | — | — | |
| `email` | VARCHAR(255) | NO | — | UNIQUE × 7 | **See section 9.1 — duplicate unique indexes** |
| `passwordHash` | VARCHAR(255) | NO | — | — | bcrypt with cost factor 10 |
| `phone` | VARCHAR(255) | YES | — | — | |
| `dob` | DATE | YES | — | — | |
| `gender` | ENUM('male','female') | YES | — | — | Note: limited to two values; PreAssessmentRegistration has 3-value ENUM |
| `yearOfEducation` | VARCHAR(255) | YES | — | — | |
| `branchId` | VARCHAR(255) | YES | — | — | Logical FK → `branches.branchId` (no DB FK) |
| `collegeId` | VARCHAR(255) | YES | — | — | Logical FK → `colleges.clgId` (no DB FK) |
| `yearOfStudy` | INT | YES | — | — | |
| `educationLevel` | VARCHAR(50) | YES | — | — | Migrated 2026-04-21 |
| `branch` | VARCHAR(255) | YES | — | — | Free-text branch name (parallel to `branchId`) |
| `collegeName` | VARCHAR(255) | YES | — | — | Free-text college name (parallel to `collegeId`) |
| `graduationYear` | VARCHAR(10) | YES | — | — | |
| `collegeCode` | VARCHAR(100) | YES | — | — | |
| `orgId` | VARCHAR(255) | YES | — | — | Logical FK → `organisations.orgId` |
| `assessmentId` | VARCHAR(255) | YES | — | — | Logical FK → `assessments.assessmentId` |
| `programInterested` | VARCHAR(255) | YES | — | — | Free-text program label |
| `profileStatus` | ENUM('active','inactive','pending') | YES | pending | — | |
| `location` | VARCHAR(255) | YES | — | — | |
| `address` | VARCHAR(255) | YES | — | — | |
| `lastLogin` | DATETIME | YES | — | — | Updated on login by auth-service |
| `preScore` | INT | YES | — | — | Pre-assessment score (0-100) |
| `preScoreDuration` | INT | YES | — | — | Seconds spent on pre-assessment |
| `postScore` | INT | YES | — | — | |
| `postScoreDuration` | INT | YES | — | — | **Added by admin-service boot-time ALTER**, not a migration |
| `refreshToken` | VARCHAR(1024) | YES | — | — | JWT refresh token (stored in plaintext) |
| `roleId` | VARCHAR(255) | NO | — | FK → roles.roleId (model-level only) | |
| `assignedProgram` | VARCHAR(255) | YES | — | — | Program assigned by admin program-request workflow |
| `programResponseStatus` | ENUM('pending','accepted','rejected') | YES | — | — | |
| `programRespondedAt` | DATETIME | YES | — | — | |
| `quizScores` | JSON | YES | — | — | Map of per-quiz scores |
| `expertise` | VARCHAR(255) | YES | — | — | Teacher profile |
| `bio` | VARCHAR(1000) | YES | — | — | Teacher profile |
| `yearsOfExperience` | INT | YES | — | — | Teacher profile |
| `linkedinUrl` | VARCHAR(255) | YES | — | — | Teacher profile |
| `teacherPhoto` | VARCHAR(255) | YES | — | — | **Added by admin-service boot-time ALTER** |
| `studentPhoto` | VARCHAR(255) | YES | — | — | **Added by admin-service boot-time ALTER** |
| `createdAt` | DATETIME | NO | — | — | |
| `updatedAt` | DATETIME | NO | — | — | |

**Indexes:**
- `email` (UNIQUE) — **plus 6 duplicate UNIQUE indexes `email_2`...`email_7`**. Cause: repeated `sequelize.sync({ alter: false })` runs from multiple services each define the column with `unique: true`, and Sequelize cannot detect that the index already exists with a different auto-generated name. **Cleanup: drop `email_2`...`email_7`.**
- `roleId` (non-unique)

**Foreign Keys:** None at the DB level (despite `User.belongsTo(Role)` in the model).

**Relationships:**
- `belongsTo` Role (model-level, via `roleId`)
- Logical/cross-DB: `belongsTo` College (`collegeId`), Organisation (`orgId`), Branch (`branchId`), Assessment (`assessmentId`)

**Cascade behavior:** None.

---

### 4.1.2 `roles` (rows≈4)

**Purpose:** Role lookup table. Four enum values.

**Used by:** auth-service.

**Sequelize model:** `auth-service/src/db/models/Role.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `roleId` | VARCHAR(255) | NO | — | PK |
| `role` | ENUM('student','teacher','admin','auditor') | NO | — | |

**Indexes:** PK only.
**Relationships:** `hasMany` User.
**Seeded by:** `auth-service/scripts/seedAdmin.js` creates the admin role on demand.

---

### 4.1.3 `colleges` (rows≈3)

**Purpose:** Master record of partner colleges. Owned by `college-service`.

**Used by:** college-service (owner), admin-service (read via authDb), course-service (logical reference via `clgIds` JSON), payment-service (duplicate model).

**Sequelize model:** `college-service/src/db/models/College.js` (also `payment-service/src/db/models/College.js` — duplicate definition, see §9.4)

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `clgId` | VARCHAR(255) | NO | — | PK |
| `accesskey` | VARCHAR(255) | NO | — | UNIQUE |
| `clgName` | VARCHAR(255) | NO | — | — |
| `clgAddress` | TEXT | YES | — | — |
| `orgId` | VARCHAR(255) | YES | — | FK → `organisations.orgId` |
| `branchIds` | JSON | YES | — | — (denormalized M:N to branches) |
| `createdAt` | DATETIME | NO | — | — |
| `updatedAt` | DATETIME | NO | — | — |

**Indexes:** `accesskey` (UNIQUE), `orgId`.
**FK:** `orgId` → `organisations.orgId`.
**Relationships:** belongs to Organisation; many-to-many with Branch via the JSON array.

---

### 4.1.4 `organisations` (rows≈0)

**Purpose:** Master record of partner organizations (parent of colleges).

**Used by:** organization-service (owner), college-service (FK target), admin-service (referenced in `assertOrgExists` raw query).

**Sequelize model:** `organization-service/src/db/models/Organization.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `orgId` | VARCHAR(255) | NO | — | PK |
| `accesskey` | VARCHAR(255) | NO | — | UNIQUE |
| `orgName` | VARCHAR(255) | NO | — | — |
| `orgState` | VARCHAR(255) | YES | — | — |
| `orgCountry` | VARCHAR(255) | YES | — | — |
| `orgAddress` | TEXT | YES | — | — |
| `orgPin` | VARCHAR(255) | YES | — | — |
| `createdAt` | DATETIME | NO | — | — |
| `updatedAt` | DATETIME | NO | — | — |

**Indexes:** `accesskey` (UNIQUE).
**Relationships:** `hasMany` College.

---

### 4.1.5 `branches` (rows≈0)

**Purpose:** Department/branch lookup (e.g. "Computer Science", "Electronics"). Used by college admins.

**Used by:** college-service (owner), payment-service (duplicate model).

**Sequelize model:** `college-service/src/db/models/Branch.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `branchId` | VARCHAR(255) | NO | — | PK |
| `branchName` | VARCHAR(255) | NO | — | UNIQUE |

**Indexes:** `branchName` (UNIQUE).
**Relationships:** referenced from `colleges.branchIds` JSON array; logical reference from `users.branchId`.

---

### 4.1.6 `courses` (rows≈3) — *parallel to* `lms_admin.courses`

**Purpose:** Course catalog owned by `course-service`. **Distinct from `lms_admin.courses`** — different PK, different shape. The two tables are not synchronized; admin-service reads/writes its own `lms_admin.courses` and never touches this one for course CRUD.

**Used by:** course-service.

**Sequelize model:** `course-service/src/db/models/Course.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `courseId` | VARCHAR(255) | NO | — | PK |
| `title` | VARCHAR(255) | NO | — | — |
| `description` | TEXT | YES | — | — |
| `duration` | INT | NO | — | — |
| `isPreAssessmentNeeded` | TINYINT(1) | YES | 0 | — |
| `modules` | JSON | YES | — | Array of module objects |
| `clgIds` | JSON | NO | `JSON_ARRAY()` | Backfill via migration 20260515 |
| `teacherId` | VARCHAR(255) | YES | — | Logical FK → `users.userId`. Migration 20260516. |
| `createdAt` | DATETIME | NO | — | — |
| `updatedAt` | DATETIME | NO | — | — |

**Indexes:** PK only.
**Relationships (logical):** referenced from `enrollments.courseId`.

---

### 4.1.7 `enrollments` (rows≈2)

**Purpose:** Student↔course enrollments owned by `course-service`. Distinct from admin-service's `user_progress` (which serves a different program-enrollment workflow).

**Used by:** course-service.

**Sequelize model:** `course-service/src/db/models/Enrollment.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `enrollmentId` | VARCHAR(255) | NO | — | PK |
| `userId` | VARCHAR(255) | NO | — | Logical FK (no DB FK; cross-DB) |
| `courseId` | VARCHAR(255) | NO | — | FK → `lucy_devdb.courses.courseId` |
| `status` | ENUM('enrolled','in-progress','completed','dropped') | NO | enrolled | |
| `enrolledAt` | DATETIME | YES | — | |
| `completedAt` | DATETIME | YES | — | |
| `createdAt` | DATETIME | NO | — | — |
| `updatedAt` | DATETIME | NO | — | — |

**Indexes:** `userId`, `courseId`.
**FK:** `courseId` → `courses.courseId`.

---

### 4.1.8 `assessments` (rows≈3)

**Purpose:** A scheduled assessment instance (pre- or post-program) for a student.

**Used by:** assessment-service (owner).

**Sequelize model:** `assessment-service/src/db/models/Assessment.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `assessmentId` | VARCHAR(255) | NO | — | PK |
| `type` | ENUM('pre','post') | NO | — | — |
| `setId` | VARCHAR(255) | NO | — | FK → `questionsets.setId` |
| `startAt` | DATETIME | YES | — | — |
| `endAt` | DATETIME | YES | — | — |
| `score` | FLOAT | YES | — | — |
| `timer` | INT | YES | — | Seconds |
| `status` | ENUM('not-started','available','in-progress','completed','expired') | NO | not-started | |
| `clgIds` | JSON | NO | — | Array of college IDs |
| `courseIds` | JSON | NO | — | Array of course IDs (denormalized M:N) |
| `createdAt` | DATETIME | NO | — | — |
| `updatedAt` | DATETIME | NO | — | — |

**Indexes:** `setId`.
**FK:** `setId` → `questionsets.setId`.

---

### 4.1.9 `questionsets` (rows≈2)

**Purpose:** A named collection of questions. `questions` field stores an ordered array of `quesId` strings (denormalized M:N).

**Used by:** assessment-service.

**Sequelize model:** `assessment-service/src/db/models/QuestionSet.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `setId` | VARCHAR(255) | NO | — | PK |
| `setName` | VARCHAR(255) | NO | — | — |
| `category` | VARCHAR(255) | YES | — | — |
| `questions` | JSON | NO | `[]` | Array of quesId strings |
| `createdAt` | DATETIME | NO | — | — |
| `updatedAt` | DATETIME | NO | — | — |

**Indexes:** PK only.

---

### 4.1.10 `questions` (rows≈40) — *general pool*

**Purpose:** Pool of multiple-choice questions for assessments. Distinct from `lms_admin.questions` (which is a quiz-question table for course lessons).

**Used by:** assessment-service.

**Sequelize model:** `assessment-service/src/db/models/Question.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `quesId` | VARCHAR(255) | NO | — | PK |
| `question` | TEXT | NO | — | — |
| `correctAns` | VARCHAR(255) | NO | — | — |
| `options` | JSON | NO | — | Object `{option1, option2, option3, option4}` |
| `category` | VARCHAR(255) | YES | — | — |
| `questionSeverity` | ENUM('easy','medium','hard') | YES | — | — |
| `createdAt` | DATETIME | NO | — | — |
| `updatedAt` | DATETIME | NO | — | — |

**Indexes:** PK only.

---

### 4.1.11 `pre_assessment_registrations` (rows≈38)

**Purpose:** Student submits onboarding form (full name, gender, program, college proof) before being allowed to take the pre-assessment.

**Used by:** assessment-service (owner), admin-service (read via `assessmentDb`).

**Sequelize model:** `assessment-service/src/db/models/PreAssessmentRegistration.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `registrationId` | VARCHAR(255) | NO | — | PK |
| `userId` | VARCHAR(255) | YES | — | Logical FK; nullable for walk-in |
| `fullName` | VARCHAR(120) | NO | — | — |
| `email` | VARCHAR(160) | NO | — | — |
| `phoneNumber` | VARCHAR(20) | NO | — | Validated by regex |
| `gender` | ENUM('Male','Female','Other') | NO | — | — |
| `selectedProgram` | ENUM('AI Frontier','AI Frontier Plus','Elite AI Residency') | NO | — | — |
| `uploadedCollegeProof` | JSON | NO | — | `{fileName, originalName, mimeType, size, url, storedAt}` |
| `declarationAccepted` | TINYINT(1) | NO | 0 | App-layer validator: must be true |
| `assessmentStatus` | ENUM('registered','in-progress','completed','abandoned') | NO | registered | — |
| `assessmentStartedAt` | DATETIME | YES | — | — |
| `submittedFromIp` | VARCHAR(64) | YES | — | Audit trace |
| `submittedUserAgent` | VARCHAR(255) | YES | — | Audit trace |
| `createdAt` | DATETIME | NO | — | — |
| `updatedAt` | DATETIME | NO | — | — |

**Indexes:** `userId`, `email`, `selectedProgram`, `assessmentStatus`.
**FKs:** None at DB level.

---

### 4.1.12 `program_requests` (rows≈16)

**Purpose:** Admin sends a program offer to a student (e.g. "you qualify for AI Frontier Plus"); student accepts or rejects via the public dashboard. **One row per (user_id) — UNIQUE constraint enforces upsert semantics.**

**Used by:** admin-service (writes via `StudentService.sendProgramRequest`), public student endpoints.

**Sequelize model:** None — accessed via raw SQL only in `admin-service/src/services/StudentService.js`.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | VARCHAR(255) | NO | — | UNIQUE (key=`user_id`) |
| `program` | ENUM('AI Frontier Program','AI Frontier Plus Program','Elite AI Residency') | NO | — | indexed |
| `status` | ENUM('sent','accepted','rejected','cancelled') | NO | sent | indexed |
| `requested_by` | VARCHAR(255) | YES | — | admin who sent it |
| `note` | VARCHAR(500) | YES | — | — |
| `responded_at` | DATETIME | YES | — | — |
| `created_at` | DATETIME | NO | CURRENT_TIMESTAMP | — |
| `updated_at` | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | — |

**Indexes:** `user_id` (UNIQUE), `idx_program`, `idx_status`.

---

### 4.1.13 `certificates` (rows≈0) — *unused duplicate*

Defined in MySQL but **no Sequelize model and no code references**. Live row count: 0. Recommendation: drop.

### 4.1.14 `settings` (rows≈0) — *unused duplicate*

Same as above. No model, no references, drop.

---

## 4.2 Tables in `lms_admin`

### 4.2.1 `users` (rows≈8) — *admin accounts*

**Purpose:** Admin user accounts for the admin panel. **Separate from `lucy_devdb.users`** — admins log into the admin panel using these rows, NOT lucy_devdb rows. Created by `seedRootAdmin.js` and `seedCollegeAdmin.js`.

**Sequelize model:** `admin-service/src/models/User.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `role` | VARCHAR(100) | NO | — | "admin", "teacher" |
| `email` | VARCHAR(255) | NO | — | UNIQUE |
| `status` | INT | YES | — | 1=active |
| `name` | VARCHAR(255) | YES | — | — |
| `phone` | VARCHAR(255) | YES | — | — |
| `website` | VARCHAR(255) | YES | — | — |
| `skills` | TEXT | YES | — | — |
| `facebook` | TEXT | YES | — | — |
| `twitter` | VARCHAR(255) | YES | — | — |
| `linkedin` | VARCHAR(255) | YES | — | — |
| `address` | VARCHAR(255) | YES | — | — |
| `college_name` | VARCHAR(255) | YES | — | — |
| `college_id` | VARCHAR(255) | YES | — | Logical FK → `lucy_devdb.colleges.clgId`. Null for root admins. |
| `about` | TEXT | YES | — | — |
| `biography` | LONGTEXT | YES | — | — |
| `educations` | LONGTEXT | YES | — | — |
| `photo` | VARCHAR(255) | YES | — | — |
| `email_verified_at` | DATETIME | YES | — | — |
| `password` | VARCHAR(255) | YES | — | bcrypt cost 10 |
| `remember_token` | VARCHAR(100) | YES | — | — |
| `paymentkeys` | LONGTEXT | YES | — | — |
| `video_url` | VARCHAR(255) | YES | — | — |
| `created_at` | DATETIME | NO | — | — |
| `updated_at` | DATETIME | NO | — | — |

**Indexes:** `email` (UNIQUE).
**FK:** None.
**Relationships:** `hasMany` Course (model-level).

---

### 4.2.2 `categories` (rows≈1)

**Purpose:** Hierarchical course category tree (`parent_id` self-references for nested categories).

**Sequelize model:** `admin-service/src/models/Category.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `parent_id` | INT | YES | — | FK → `categories.id` |
| `title` | VARCHAR(255) | NO | — | — |
| `slug` | VARCHAR(255) | YES | — | — |
| `icon` | VARCHAR(255) | YES | — | — |
| `sort` | INT | YES | 0 | — |
| `status` | VARCHAR(50) | YES | active | — |
| `keywords` | VARCHAR(400) | YES | — | — |
| `description` | VARCHAR(500) | YES | — | — |
| `thumbnail` | VARCHAR(255) | YES | — | — |
| `category_logo` | VARCHAR(255) | YES | — | — |
| `clg_ids` | JSON | YES | — | Array of clgIds (denormalized M:N) |
| `created_at` | DATETIME | NO | — | — |
| `updated_at` | DATETIME | NO | — | — |

**Indexes:** `parent_id`.
**FK:** `parent_id` → `categories.id` (self-reference, no cascade).
**Relationships:** `hasMany` Category (children), `hasMany` Course.

---

### 4.2.3 `courses` (rows≈2)

**Purpose:** Primary course catalog in the LMS. Distinct from `lucy_devdb.courses`.

**Sequelize model:** `admin-service/src/models/Course.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `title` | VARCHAR(255) | NO | — | — |
| `slug` | VARCHAR(255) | YES | — | — |
| `short_description` | TEXT | YES | — | — |
| `user_id` | INT | YES | — | FK → `users.id` (creator) |
| `category_id` | INT | YES | — | FK → `categories.id` |
| `course_type` | VARCHAR(50) | YES | general | — |
| `status` | VARCHAR(50) | YES | active | — |
| `level` | VARCHAR(50) | YES | — | — |
| `language` | VARCHAR(50) | YES | — | — |
| `is_paid` | TINYINT(1) | YES | 0 | — |
| `is_best` | TINYINT(1) | YES | 0 | "featured" flag |
| `price` | FLOAT | YES | 0 | — |
| `discounted_price` | FLOAT | YES | 0 | — |
| `discount_flag` | TINYINT(1) | YES | 0 | — |
| `enable_drip_content` | TINYINT(1) | YES | 0 | — |
| `drip_content_settings` | TEXT | YES | — | JSON-encoded |
| `meta_keywords` | TEXT | YES | — | — |
| `meta_description` | TEXT | YES | — | — |
| `thumbnail` | VARCHAR(255) | YES | — | — |
| `banner` | VARCHAR(255) | YES | — | — |
| `preview` | VARCHAR(255) | YES | — | — |
| `description` | LONGTEXT | YES | — | — |
| `requirements` | TEXT | YES | — | — |
| `outcomes` | TEXT | YES | — | — |
| `faqs` | TEXT | YES | — | — |
| `teacher_ids` | TEXT | YES | — | JSON-encoded array of user_ids |
| `clg_ids` | JSON | YES | — | Array of clgIds (no DB FK, cross-DB) |
| `average_rating` | FLOAT | YES | 0 | — |
| `expiry_period` | INT | YES | — | — |
| `has_certificate` | TINYINT(1) | NO | 1 | **Boot-time ALTER** |
| `created_at` | DATETIME | NO | — | — |
| `updated_at` | DATETIME | NO | — | — |

**Indexes:** `user_id`, `category_id`.
**FKs:** `user_id` → `users.id`, `category_id` → `categories.id`.
**Relationships:** belongsTo Category, belongsTo User (creator); hasMany Section, Lesson (via `course_id` on those tables).

---

### 4.2.4 `sections` (rows≈3)

**Purpose:** Top-level grouping of lessons within a course.

**Sequelize model:** `admin-service/src/models/Section.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | INT | YES | — | — |
| `course_id` | INT | YES | — | FK → `courses.id` |
| `title` | VARCHAR(255) | YES | — | — |
| `sort` | INT | YES | — | — |
| `created_at` | DATETIME | NO | — | — |
| `updated_at` | DATETIME | NO | — | — |

**Indexes:** `course_id`.
**FK:** `course_id` → `courses.id`.

---

### 4.2.5 `lessons` (rows≈7)

**Purpose:** Individual lesson units (video, quiz, assignment, document) within a section.

**Sequelize model:** `admin-service/src/models/Lesson.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `title` | VARCHAR(255) | YES | — | — |
| `user_id` | INT | YES | — | — |
| `course_id` | INT | YES | — | FK → `courses.id` |
| `section_id` | INT | YES | — | FK → `sections.id` |
| `lesson_type` | VARCHAR(255) | YES | — | "video", "quiz", "assignment", "document" |
| `duration` | VARCHAR(255) | YES | — | mm:ss string |
| `total_mark` | INT | YES | — | — |
| `pass_mark` | INT | YES | — | — |
| `retake` | INT | YES | — | — |
| `lesson_src` | VARCHAR(255) | YES | — | Video URL or file path |
| `attachment` | LONGTEXT | YES | — | — |
| `attachment_type` | VARCHAR(255) | YES | — | — |
| `video_type` | TEXT | YES | — | — |
| `thumbnail` | VARCHAR(255) | YES | — | — |
| `is_free` | INT | YES | — | — |
| `sort` | INT | YES | — | — |
| `description` | LONGTEXT | YES | — | — |
| `summary` | LONGTEXT | YES | — | — |
| `status` | INT | YES | — | — |
| `created_at` | DATETIME | NO | — | — |
| `updated_at` | DATETIME | NO | — | — |

**Indexes:** `course_id`, `section_id`.
**FKs:** `course_id` → `courses.id`, `section_id` → `sections.id`.

---

### 4.2.6 `questions` (rows≈1)

**Purpose:** Quiz questions for lessons of type `quiz`. **Distinct from `lucy_devdb.questions`** (which is for assessments).

**Sequelize model:** `admin-service/src/models/Question.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `quiz_id` | INT | YES | — | Logical FK → `lessons.id` (no DB FK) |
| `title` | LONGTEXT | YES | — | — |
| `type` | VARCHAR(255) | YES | — | — |
| `answer` | MEDIUMTEXT | YES | — | — |
| `options` | LONGTEXT | YES | — | JSON-encoded |
| `sort` | INT | YES | — | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

---

### 4.2.7 `quiz_submissions` (rows≈7)

**Purpose:** One row per student attempt at a quiz lesson. Preserves the answer breakdown and the score.

**Sequelize model:** `admin-service/src/models/QuizSubmission.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `quiz_id` | INT | YES | — | Logical FK → `lessons.id` |
| `user_id` | INT | YES | — | Cross-DB logical FK; **note INT, not BIGINT — could overflow on real userIds** |
| `correct_answer` | LONGTEXT | YES | — | JSON |
| `wrong_answer` | LONGTEXT | YES | — | JSON |
| `submits` | LONGTEXT | YES | — | JSON of all submissions |
| `score` | INT | YES | — | — |
| `total` | INT | YES | — | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

---

### 4.2.8 `live_classes` (rows≈2)

**Purpose:** Live class scheduling (Zoom integration).

**Sequelize model:** `admin-service/src/models/LiveClass.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | BIGINT | YES | — | **Widened INT→BIGINT by boot-time ALTER** |
| `course_id` | INT | YES | — | Logical FK |
| `class_topic` | VARCHAR(255) | YES | — | — |
| `provider` | VARCHAR(255) | YES | — | "zoom", "meet", etc. |
| `class_date_and_time` | DATETIME | YES | — | — |
| `additional_info` | LONGTEXT | YES | — | — |
| `note` | TEXT | YES | — | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

---

### 4.2.9 `pre_assessment_results` (rows≈18)

**Purpose:** Per-student score record for the pre-assessment. Mirrors `lucy_devdb.users.preScore` but adds `passed` and timestamps.

**Sequelize model:** `admin-service/src/models/PreAssessmentResult.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | BIGINT | NO | — | Cross-DB logical FK |
| `program_id` | INT | YES | — | Logical FK |
| `score` | FLOAT | NO | 0 | — |
| `passed` | TINYINT(1) | NO | 0 | — |
| `duration_seconds` | INT | YES | — | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `(user_id, program_id)`.

---

### 4.2.10 `user_progress` (rows≈31)

**Purpose:** A student's enrollment in a program, including their most recent lesson and current course. **One row per (user_id, program_id) — UNIQUE constraint.**

**Sequelize model:** `admin-service/src/models/UserProgress.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | BIGINT | NO | — | Cross-DB logical FK |
| `program_id` | INT | NO | — | Logical FK → `programs.id` |
| `course_id` | INT | YES | — | Logical FK → `courses.id` |
| `last_lesson_id` | INT | YES | — | Logical FK → `lessons.id` |
| `enrolled` | TINYINT(1) | NO | 0 | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `(user_id, program_id)` UNIQUE; `user_id`.

---

### 4.2.11 `lesson_completions` (rows≈56)

**Purpose:** One row per (user, lesson) once the lesson is marked complete (≥30% watch or manual).

**Sequelize model:** `admin-service/src/models/LessonCompletion.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | BIGINT | NO | — | Cross-DB logical FK |
| `course_id` | INT | NO | — | Logical FK |
| `lesson_id` | INT | NO | — | Logical FK |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `(user_id, lesson_id)` UNIQUE; `(user_id, course_id)`.

---

### 4.2.12 `lesson_watch_progress` (rows≈41)

**Purpose:** Live watch position for a lesson. `current_duration` is the high-water mark in seconds.

**Sequelize model:** `admin-service/src/models/LessonWatchProgress.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | BIGINT | NO | — | Cross-DB logical FK |
| `course_id` | INT | NO | — | Logical FK |
| `lesson_id` | INT | NO | — | Logical FK |
| `current_duration` | INT | NO | 0 | Seconds |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `(user_id, lesson_id)` UNIQUE; `(user_id, course_id)`.

---

### 4.2.13 `certificates` (rows≈7)

**Purpose:** Issued completion certificates.

**Sequelize model:** `admin-service/src/models/Certificate.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | VARCHAR(255) | YES | — | Auth-service userId shape |
| `course_id` | INT | YES | — | Logical FK |
| `identifier` | VARCHAR(100) | YES | — | UNIQUE — public certificate code |
| `title` | VARCHAR(255) | YES | — | — |
| `description` | TEXT | YES | — | — |
| `template_image` | VARCHAR(255) | YES | — | — |
| `status` | TINYINT | YES | 1 | 1=visible, 0=hidden |
| `issued_at` | DATETIME | YES | — | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `identifier` (UNIQUE), `user_id`, `course_id`.

---

### 4.2.14 `coupons` (rows≈1)

**Purpose:** Discount codes.

**Sequelize model:** `admin-service/src/models/Coupon.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `user_id` | INT | NO | — | (admin who created it) |
| `code` | VARCHAR(255) | NO | — | UNIQUE |
| `discount` | INT | NO | — | Percentage or amount |
| `expiry` | BIGINT | NO | — | Unix ms |
| `status` | TINYINT | YES | 1 | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `code` (UNIQUE).

---

### 4.2.15 `languages` (rows≈2)

**Purpose:** UI language registry.

**Sequelize model:** `admin-service/src/models/Language.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `name` | VARCHAR(100) | NO | — | UNIQUE |
| `code` | VARCHAR(20) | YES | — | — |
| `direction` | ENUM('ltr','rtl') | NO | ltr | — |
| `is_default` | TINYINT(1) | NO | 0 | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

---

### 4.2.16 `programs` (rows≈3)

**Purpose:** Top-level programs (AI Frontier, AI Frontier Plus, Elite AI Residency).

**Sequelize model:** `admin-service/src/models/Program.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `title` | VARCHAR(255) | NO | — | — |
| `tagline` | VARCHAR(500) | YES | — | — |
| `icon` | VARCHAR(64) | YES | Globe2 | lucide-react icon name |
| `features` | JSON | NO | — | Array of feature strings |
| `sort` | INT | YES | 0 | — |
| `is_active` | TINYINT(1) | YES | 1 | — |
| `clg_ids` | JSON | YES | — | **Boot-time ALTER** |
| `course_id` | INT | YES | — | Legacy single-course FK, **Boot-time ALTER** |
| `course_ids` | JSON | YES | — | Multi-course list, **Boot-time ALTER** |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

---

### 4.2.17 `batches` (rows≈2)

**Purpose:** Named student cohorts at a college.

**Sequelize model:** `admin-service/src/models/Batch.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `clg_id` | VARCHAR(64) | NO | — | Logical FK → `lucy_devdb.colleges.clgId` (indexed) |
| `name` | VARCHAR(160) | NO | — | — |
| `description` | VARCHAR(500) | YES | — | — |
| `start_date` | DATE | YES | — | — |
| `end_date` | DATE | YES | — | — |
| `is_active` | TINYINT(1) | YES | 1 | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `clg_id`.

---

### 4.2.18 `batch_members` (rows≈7)

**Purpose:** Junction table linking students to batches.

**Sequelize model:** `admin-service/src/models/BatchMember.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `batch_id` | INT | NO | — | Logical FK → `batches.id` |
| `user_id` | VARCHAR(32) | NO | — | Logical FK → `lucy_devdb.users.userId` |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `(batch_id, user_id)` UNIQUE; `user_id`.

---

### 4.2.19 `forums` (rows≈11)

**Purpose:** Course Q&A threads + replies. Self-referencing tree via `parent_id`.

**Sequelize model:** `admin-service/src/models/Forum.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `course_id` | INT | YES | — | FK → `courses.id` |
| `user_id` | BIGINT | YES | — | Cross-DB logical FK |
| `parent_id` | INT | YES | — | FK → `forums.id` |
| `title` | VARCHAR(255) | YES | — | "reply" for child rows |
| `description` | LONGTEXT | YES | — | — |
| `likes` | LONGTEXT | YES | — | JSON array of user_ids |
| `dislikes` | LONGTEXT | YES | — | JSON array of user_ids |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `course_id`, `parent_id`.
**FKs:** `course_id` → `courses.id`, `parent_id` → `forums.id`.

---

### 4.2.20 `forum_reports` (rows≈1)

**Purpose:** Users flag forum posts as inappropriate.

**Sequelize model:** `admin-service/src/models/ForumReport.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `forum_id` | INT | NO | — | FK → `forums.id` |
| `user_id` | BIGINT | NO | — | Cross-DB logical FK |
| `reason` | TEXT | YES | — | — |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

**Indexes:** `(forum_id, user_id)` UNIQUE.
**FK:** `forum_id` → `forums.id`.

---

### 4.2.21 `seo_fields` (rows≈0)

**Purpose:** Per-course SEO meta. Currently unused (0 rows).

**Sequelize model:** `admin-service/src/models/SeoField.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `course_id` | INT | YES | — | Logical FK |
| `route` | VARCHAR(255) | YES | — | — |
| `name_route`, `meta_title`, `meta_description`, `meta_keywords`, `meta_robot`, `canonical_url`, `custom_url`, `json_ld`, `og_title`, `og_description`, `og_image` | various | YES | — | All SEO meta fields |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

---

### 4.2.22 `settings` (rows≈9)

**Purpose:** Key-value settings store.

**Sequelize model:** `admin-service/src/models/Setting.js`

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| `id` | INT | NO | — | PK, auto_increment |
| `type` | VARCHAR(255) | YES | — | Key |
| `description` | LONGTEXT | YES | — | Value (often JSON) |
| `created_at`, `updated_at` | DATETIME | NO | — | — |

---

# 5. Migration Analysis

## 5.1 Migration Inventory

The repository contains **3 hand-written migration files**, none of which are tied to an active migration runner.

| File | Targets | Up Behavior | Rollback |
|---|---|---|---|
| `auth-service/src/db/migrations/20260421-add-academic-info-to-users.{js,sql}` | `lucy_devdb.users` | ADD 5 columns: `educationLevel` (ENUM), `branch`, `collegeName`, `graduationYear`, `collegeCode` | DROP same 5 columns |
| `course-service/src/db/migrations/20260515-add-clgIds-to-courses.{js,sql}` | `lucy_devdb.courses` | ADD `clgIds` JSON NOT NULL DEFAULT (JSON_ARRAY()), with backfill UPDATE for NULLs | DROP column |
| `course-service/src/db/migrations/20260516-add-teacherId-to-courses.js` | `lucy_devdb.courses` | ADD `teacherId` VARCHAR NULL | DROP column |

All three are marked idempotent (use `queryInterface.describeTable` to skip if column exists) so they can be re-run safely. **However, no project script invokes them.** They were applied by hand against the live database.

## 5.2 Boot-Time DDL (admin-service/server.js)

The admin-service runs the following idempotent schema patches on every startup. This is the **de facto migration mechanism** for this project.

| Block | Targets | Action | Trigger |
|---|---|---|---|
| 1 | `lucy_devdb.users.teacherPhoto` | ADD COLUMN VARCHAR(255) NULL | DESCRIBE check |
| 2 | `lucy_devdb.users.studentPhoto` | ADD COLUMN VARCHAR(255) NULL | DESCRIBE check |
| 3 | `lucy_devdb.users.postScoreDuration` | ADD COLUMN INT NULL | DESCRIBE check |
| 4 | `lms_admin.languages` | `Language.sync()` (CREATE TABLE IF NOT EXISTS) | unconditional |
| 5 | `lms_admin.courses.has_certificate` | ADD COLUMN TINYINT(1) NOT NULL DEFAULT 1 | SHOW COLUMNS check |
| 6 | `lms_admin.forums`, `lms_admin.forum_reports` | `.sync()` | unconditional |
| 7 | `lms_admin.programs` | `Program.sync()` | unconditional |
| 8 | `lms_admin.batches`, `lms_admin.batch_members` | `.sync()` | unconditional |
| 9 | `lms_admin.programs.clg_ids` / `.course_id` / `.course_ids` | ADD COLUMN JSON / INT NULL × 3 | SHOW COLUMNS check |
| 10 | `lms_admin.live_classes.user_id` | MODIFY COLUMN BIGINT | SHOW COLUMNS check (only if INT) |

## 5.3 `sequelize.sync()` Calls

| Service | Behavior |
|---|---|
| `admin-service` | `sequelize.sync({ alter: false })` via `scripts/syncSchema.js` (manual). Plus per-model `.sync()` in server.js (forums, languages, batches, programs). |
| `auth-service` | `sequelize.sync()` (no options) in both seed scripts. |
| Other services | No automatic `sync()` — schema only exists because somebody ran one earlier. |

## 5.4 Schema Provenance

| Table | Provenance |
|---|---|
| `lucy_devdb.users` | `auth-service` model `sync()` + auth-service migration 20260421 + admin-service boot-time ALTERs |
| `lucy_devdb.roles` | `auth-service` model `sync()` |
| `lucy_devdb.colleges`, `branches`, `organisations` | `college-service` / `organization-service` model `sync()` (manual) |
| `lucy_devdb.courses`, `enrollments` | `course-service` model `sync()` + migrations 20260515, 20260516 |
| `lucy_devdb.assessments`, `questions`, `questionsets`, `pre_assessment_registrations` | `assessment-service` model `sync()` |
| `lucy_devdb.program_requests` | **Unknown** — no model, no migration file. Hand-created. |
| `lucy_devdb.certificates`, `lucy_devdb.settings` | **Unknown, unused** |
| All `lms_admin.*` | admin-service `sync()` via `scripts/syncSchema.js` + boot-time ALTERs |

---

# 6. Seeder & Initial Data Analysis

## 6.1 Seeder Inventory

| Script | Inserts Into | Default Values |
|---|---|---|
| `auth-service/src/scripts/seedAdmin.js` | `lucy_devdb.roles` (admin role if missing), `lucy_devdb.users` | email=`admin@gmail.com`, password=`admin123` |
| `auth-service/src/scripts/seedCollegeAdmin.js` | `lucy_devdb.roles`, `lucy_devdb.users` | email=`college-admin@gmail.com`, password=`college123`, collegeId=`COLLEGE001` |
| `admin-service/src/scripts/seedRootAdmin.js` | `lms_admin.users` | email=`root@admin.com`, password=`password123` |
| `admin-service/src/scripts/seedCollegeAdmin.js` | `lms_admin.users` | email=`college-admin@gmail.com`, password=`college123`, college_id=`COLLEGE001` |

All seeders:
- Hash passwords with bcrypt cost 10
- Are upsert-by-email (update password if user exists)
- Take optional CLI args: `node seedRootAdmin.js <email> <password> <name>`

**No data-only seeders exist** for languages, programs, categories, or any other reference data. Real-world setup requires manual inserts via the admin UI.

## 6.2 Default Inserted Data

The only data that is auto-created on first boot is:
- The four enum-style rows in `lucy_devdb.roles` (created lazily by `seedAdmin.js` when missing).

There are no default categories, languages, programs, settings, or colleges. A fresh deployment is **completely empty** apart from whatever admins are seeded.

## 6.3 Default Admin Credentials (Security Risk)

**The default passwords are hardcoded and weak:**
- `password123` (root admin)
- `admin123` (auth-service admin)
- `college123` (college admins)

These appear in plaintext in source-controlled `.js` files. In any environment where these scripts have ever been run with default args, the admin account is effectively unprotected.

---

# 7. Relationships & ERD

## 7.1 Relationship Catalogue (DB-enforced foreign keys)

### `lucy_devdb`
| Child | Column | Parent | On Delete | On Update |
|---|---|---|---|---|
| `assessments.setId` | → | `questionsets.setId` | (default) | (default) |
| `colleges.orgId` | → | `organisations.orgId` | (default) | (default) |
| `enrollments.userId` | → | `users.userId` | (default) | (default) |
| `enrollments.courseId` | → | `courses.courseId` | (default) | (default) |

### `lms_admin`
| Child | Column | Parent | On Delete | On Update |
|---|---|---|---|---|
| `categories.parent_id` | → | `categories.id` (self) | (default) | (default) |
| `courses.user_id` | → | `users.id` | (default) | (default) |
| `courses.category_id` | → | `categories.id` | (default) | (default) |
| `sections.course_id` | → | `courses.id` | (default) | (default) |
| `lessons.course_id` | → | `courses.id` | (default) | (default) |
| `lessons.section_id` | → | `sections.id` | (default) | (default) |
| `forums.course_id` | → | `courses.id` | (default) | (default) |
| `forums.parent_id` | → | `forums.id` (self) | (default) | (default) |
| `forum_reports.forum_id` | → | `forums.id` | (default) | (default) |
| `certificates.user_id` | → | `users.id` (declared by model but NOT enforced — column is VARCHAR pointing at cross-DB userIds) | — | — |
| `certificates.course_id` | → | `courses.id` (declared by model only) | — | — |

(All FKs default to `RESTRICT` on update and delete. There are no `CASCADE` or `SET NULL` rules.)

## 7.2 Logical (Application-Layer) Relationships

These are not enforced by the database but the application code assumes them. Most cross the `lucy_devdb` ↔ `lms_admin` boundary.

| From | To | Notes |
|---|---|---|
| `lucy_devdb.users.collegeId` | `lucy_devdb.colleges.clgId` | Same DB but no FK |
| `lucy_devdb.users.orgId` | `lucy_devdb.organisations.orgId` | |
| `lucy_devdb.users.branchId` | `lucy_devdb.branches.branchId` | |
| `lucy_devdb.users.assessmentId` | `lucy_devdb.assessments.assessmentId` | |
| `lucy_devdb.pre_assessment_registrations.userId` | `lucy_devdb.users.userId` | |
| `lucy_devdb.program_requests.user_id` | `lucy_devdb.users.userId` | |
| `lucy_devdb.program_requests.requested_by` | `lms_admin.users.id` (string-encoded) | **Cross-DB** |
| `lms_admin.users.college_id` | `lucy_devdb.colleges.clgId` | **Cross-DB** |
| `lms_admin.user_progress.user_id` | `lucy_devdb.users.userId` (numeric cast) | **Cross-DB** |
| `lms_admin.lesson_completions.user_id` | `lucy_devdb.users.userId` | **Cross-DB** |
| `lms_admin.lesson_watch_progress.user_id` | `lucy_devdb.users.userId` | **Cross-DB** |
| `lms_admin.certificates.user_id` | `lucy_devdb.users.userId` | **Cross-DB** |
| `lms_admin.forums.user_id` | `lucy_devdb.users.userId` | **Cross-DB** |
| `lms_admin.live_classes.user_id` | `lucy_devdb.users.userId` | **Cross-DB** |
| `lms_admin.batches.clg_id` | `lucy_devdb.colleges.clgId` | **Cross-DB** |
| `lms_admin.batch_members.user_id` | `lucy_devdb.users.userId` | **Cross-DB** |
| `lms_admin.programs.course_id` and `course_ids[*]` | `lms_admin.courses.id` | |
| `lms_admin.user_progress.program_id` | `lms_admin.programs.id` | |
| `lms_admin.user_progress.course_id` | `lms_admin.courses.id` | |
| `lms_admin.user_progress.last_lesson_id` | `lms_admin.lessons.id` | |
| `lms_admin.quiz_submissions.quiz_id` | `lms_admin.lessons.id` (where lesson_type='quiz') | |
| `lms_admin.questions.quiz_id` | `lms_admin.lessons.id` | |

## 7.3 Many-to-Many (JSON-encoded)

These M:N relationships are denormalized into JSON arrays (no junction table). They are queryable in MySQL 8 via `JSON_CONTAINS` but cannot be indexed without a generated column.

| Table.Column | Targets | Used For |
|---|---|---|
| `colleges.branchIds[]` | `branches.branchId` | Which departments a college offers |
| `lms_admin.courses.clg_ids[]` | `colleges.clgId` | Colleges a course is offered at |
| `lms_admin.courses.teacher_ids` | `lucy_devdb.users.userId[]` | Course teachers |
| `lms_admin.categories.clg_ids[]` | `colleges.clgId` | Colleges a category applies to |
| `lms_admin.programs.clg_ids[]` | `colleges.clgId` | College scoping |
| `lms_admin.programs.course_ids[]` | `lms_admin.courses.id` | Courses bundled into program |
| `lucy_devdb.assessments.clgIds[]` | `colleges.clgId` | College scoping |
| `lucy_devdb.assessments.courseIds[]` | `lucy_devdb.courses.courseId` | Courses linked to assessment |
| `lucy_devdb.courses.clgIds[]` | `colleges.clgId` | College scoping (parallel to lms_admin.courses) |

## 7.4 Cardinality at a Glance

- **User → Enrollment:** 1:N (course-service `enrollments`)
- **User → UserProgress:** 1:N, but unique per program (admin-service)
- **Program → UserProgress:** 1:N
- **Course → Section:** 1:N
- **Section → Lesson:** 1:N
- **Course → Lesson:** 1:N (redundant with Section→Lesson; both columns present)
- **Lesson → LessonCompletion:** 1:N
- **Lesson → LessonWatchProgress:** 1:1 per user
- **User → Certificate:** 1:N
- **User → ProgramRequest:** **1:1** (UNIQUE on user_id)
- **Batch → BatchMember:** 1:N
- **Forum → Forum (reply):** 1:N self-reference
- **Forum → ForumReport:** 1:N

## 7.5 Ownership Hierarchy

```
Organisation
    └── College
            ├── Branch (via colleges.branchIds JSON)
            ├── Batch
            │   └── BatchMember → User
            ├── Course (via lms_admin.courses.clg_ids JSON)
            │   ├── Section
            │   │   └── Lesson
            │   │       ├── Question (quizzes)
            │   │       ├── QuizSubmission
            │   │       └── LessonCompletion / LessonWatchProgress
            │   ├── Certificate
            │   ├── Forum
            │   │   └── ForumReport
            │   └── LiveClass
            ├── Program (via programs.clg_ids JSON)
            │   └── UserProgress → Course, Lesson
            └── User (students/teachers via users.collegeId)
                ├── PreAssessmentRegistration
                ├── PreAssessmentResult
                ├── Enrollment (course-service shape)
                └── ProgramRequest
```

---

# 8. Data Flow Analysis

## 8.1 Frontend → Backend → DB

The React/Vite frontend (`/frontend`) talks to the API through three Axios clients (`src/api/`, `src/admin/api/`), all pointed at the Bastion gateway (`localhost:8000`). Bastion proxies to the backing service based on path. Each backing service then writes to MySQL.

| Path | Bastion → | DB |
|---|---|---|
| `/api/auth/*` | auth-service | `lucy_devdb` |
| `/api/admin/*` | admin-service | `lms_admin` + `lucy_devdb` (cross-DB) |
| `/api/public/*` | admin-service (most) | `lms_admin` |
| `/api/v1/college/*` | college-service | `lucy_devdb` |
| `/api/v1/course/*` | course-service | `lucy_devdb` |
| `/api/v1/assessment/*` | assessment-service | `lucy_devdb` |
| `/api/v1/organisation/*` | organization-service | `lucy_devdb` |

## 8.2 Authentication Flow

1. Student signs up via auth-service → `INSERT lucy_devdb.users`, `userId` is a generated numeric string (11 digits).
2. Login hits auth-service → bcrypt compare against `passwordHash` → JWT issued; `refreshToken` stored back on `users.refreshToken` (plaintext).
3. Admin login hits admin-service `/api/admin/auth/login` → bcrypt against `lms_admin.users.password` → separate JWT with `college_id` claim derived from `lms_admin.users.college_id`.
4. Session is JWT-only — there is **no server-side session store**, no token blacklist.

## 8.3 Course Browsing & Enrollment

1. Public catalog: `GET /api/public/courses?clgId=<id>` → admin-service queries `lms_admin.courses` filtering by `clg_ids` JSON.
2. Detail: `GET /api/public/course/:slug` → `lms_admin.courses` + joined sections + lessons.
3. Enrollment: `POST /api/admin/enroll` → upserts `lms_admin.user_progress` (UNIQUE on `(user_id, program_id)`).
4. (Course-service maintains a *separate* `lucy_devdb.enrollments` for course-level state but it's used only by the legacy enroll-controller path.)

## 8.4 Lesson Playback & Completion

1. `POST /api/public/player/progress` → upserts `lms_admin.lesson_watch_progress` (one row per user_id+lesson_id).
2. When `current_duration ≥ 30%` of lesson duration: `POST /api/public/player/complete` inserts/idempotently no-ops `lms_admin.lesson_completions`.
3. Course progress derived: `count(lesson_completions WHERE course_id=X AND user_id=Y) / count(lessons WHERE course_id=X) * 100`.
4. An in-memory `watchStore` shadow-caches the same data for hot reads, hydrated from MySQL on admin-service boot.

## 8.5 Assessment Flow

1. Student fills onboarding form (assessment-service) → `INSERT lucy_devdb.pre_assessment_registrations` (with college proof JSON metadata).
2. Student takes the pre-assessment → score posted back to **both**:
   - `lucy_devdb.users.preScore` + `users.preScoreDuration` (auth DB)
   - `lms_admin.pre_assessment_results` (admin DB, for the dashboard)
3. Post-assessment mirrors the same pattern (`postScore`, `postScoreDuration`).

This is **dual-write across two databases**. There is **no transactional consistency** between the two writes. If the second write fails, the data is split.

## 8.6 Program Request Workflow

1. Admin (root or college) picks a student in Manage Students → `POST /api/admin/students/:id/program-request` → `INSERT … ON DUPLICATE KEY UPDATE lucy_devdb.program_requests` (upsert by `user_id`).
2. Student sees the offer on their dashboard via `GET /api/public/program-request?user_id=…`
3. Student responds via `POST /api/public/program-request/respond { action: 'accept'|'reject' }` → updates `lucy_devdb.program_requests.status` + `responded_at`.
4. Accepted programs are mirrored onto `lucy_devdb.users.assignedProgram`, `programResponseStatus`, `programRespondedAt`.

Again, a dual-write across two writes within the same DB but without an explicit transaction.

## 8.7 Certificate Lifecycle

1. When the last lesson of a `has_certificate=true` course completes, the player flow inserts into `lms_admin.certificates` with a generated `identifier` (UNIQUE).
2. Public lookup: `GET /api/public/certificate/:identifier` → renders a certificate page from a template defined in `settings.certificate_template`.

## 8.8 File / Media Storage

- All file uploads go to **local disk** under `admin-service/uploads/` (mounted at `/uploads/*`).
- The DB stores **relative paths only** (`uploads/users/student/xyz.jpg`).
- The frontend prepends `VITE_ADMIN_API_URL` to render images.
- There is **no S3, CloudFront, or media CDN integration**.

## 8.9 Transactions

- Sequelize transactions: searched, only **2 occurrences across the entire backend**. Almost every multi-write operation runs as separate statements without transactional protection.
- Cross-database transactions: not used (and not supported by MySQL anyway).

---

# 9. Schema Quality & Performance Review

## 9.1 Duplicate UNIQUE Indexes on `lucy_devdb.users.email`

Live schema shows **7 distinct UNIQUE indexes on the same `email` column**: `email`, `email_2`, `email_3`, `email_4`, `email_5`, `email_6`, `email_7`. Each one is its own B-tree.

- **Cause:** Repeated `sequelize.sync()` runs from different services (auth-service, admin-service, …) each declared `email: { unique: true }` and Sequelize auto-named the new index. MySQL accepts the duplicate, the index gets created with a `_N` suffix, and INSERT/UPDATE now writes to all 7 indexes.
- **Impact:** Every INSERT and every UPDATE on `users` writes to 7 B-trees instead of 1. Wasted IO and disk; storage overhead ~7×.
- **Fix:** `DROP INDEX email_2 ON users; … DROP INDEX email_7 ON users;` — keep only `email`.

## 9.2 No Migration Runner

There is no migration framework. Schema is shaped by a mix of `sync()` calls (which can't handle column drops or type changes), three orphan migration files, and 9 boot-time `ALTER TABLE` blocks in `server.js`. As a result:

- Dev and prod schemas drift constantly.
- The history of "why does column X exist" is in commit messages, not in migration files.
- Rollback is not possible — there is no "undo".
- Two engineers running fresh setups can end up with subtly different schemas.

**Recommendation:** Adopt `sequelize-cli` or Umzug. Convert each existing boot-time ALTER into a numbered migration. Stop running `sequelize.sync()` against the production DB.

## 9.3 No Database-Level Foreign Keys Across Services

Logical references like `lms_admin.users.college_id → lucy_devdb.colleges.clgId` and `lms_admin.user_progress.user_id → lucy_devdb.users.userId` are not enforced. Orphan rows are possible whenever a deletion happens. There is no scheduled job to detect or clean them up.

## 9.4 Schema Duplication Across Services

Three services define a `College` or `Branch` model that resolve to the same physical table:
- `college-service/src/db/models/College.js`
- `payment-service/src/db/models/College.js`
- `payment-service/src/db/models/Branch.js` (duplicate of college-service's)
- `admin-service/src/services/CollegeService.js` (uses raw SQL — yet another shape)

If any one of these gets a field change without the others, the writes through that service silently diverge.

## 9.5 `lms_admin.quiz_submissions.user_id` is INT

Every other cross-DB `user_id` column in `lms_admin` (in `user_progress`, `lesson_completions`, `lesson_watch_progress`, `forums`, `live_classes`, `pre_assessment_results`, `forum_reports`) is `BIGINT` because `lucy_devdb.users.userId` is an 11-digit number that exceeds signed INT max. But `quiz_submissions.user_id` is still **INT**. Any submission by a user with userId > 2,147,483,647 (which is every real production userId) gets **silently clamped**, collapsing all attempts into one row. This is an active bug.

**Fix:** `ALTER TABLE quiz_submissions MODIFY COLUMN user_id BIGINT NULL;`

## 9.6 Refresh Tokens Stored Plaintext

`lucy_devdb.users.refreshToken VARCHAR(1024)` holds the JWT refresh token in plaintext. Anyone with read access to the DB (legitimate or via SQL injection) can impersonate any user without their password. Refresh tokens should be either hashed at rest, or moved to a separate session store that's harder to read.

## 9.7 `password` and `passwordHash` Naming Inconsistency

- `lucy_devdb.users.passwordHash` (camelCase, lucy_devdb convention)
- `lms_admin.users.password` (snake_case, lms_admin convention) — **but it stores the hash, not the password**

Misleading column name. Risk of mistakenly using `password` as plaintext. Rename to `password_hash` in `lms_admin.users`.

## 9.8 Missing Indexes

Hot query paths that lack indexes:

| Table | Column(s) | Why it matters |
|---|---|---|
| `lms_admin.certificates` | `(user_id, status)` | `certificates listing per user` filters on both — currently only `user_id` is indexed |
| `lms_admin.quiz_submissions` | `(user_id, quiz_id)` | Player restores last attempt — full table scan |
| `lms_admin.live_classes` | `course_id` | Course detail page joins to upcoming classes — no index |
| `lms_admin.live_classes` | `class_date_and_time` | Listing upcoming classes ORDER BY date |
| `lms_admin.questions` | `quiz_id` | Lesson player loads questions for a quiz lesson |
| `lms_admin.coupons` | `expiry` | Listing active coupons (where expiry > now) |
| `lucy_devdb.users` | `collegeId` | Dashboards filter by college constantly |
| `lucy_devdb.users` | `roleId` | exists, good |

## 9.9 Default-Generated `created_at` / `updated_at` Inconsistency

Only `lucy_devdb.program_requests` uses MySQL `DEFAULT CURRENT_TIMESTAMP` + `ON UPDATE CURRENT_TIMESTAMP`. Every other table relies on Sequelize to set these in application code. If a row is inserted via raw SQL bypassing Sequelize, those tables get `0000-00-00` or strict-mode insert failures.

## 9.10 N+1 Risk in Admin Dashboard

`admin-service/src/services/StudentService.js#list()` already batches enrolled-courses, certificate-counts, and assessment-meta with `IN (:ids)` clauses — that's good. **However:**

- The College Dashboard's new students table (`CollegeDashboardService` + frontend `Dashboard.jsx`) calls `listStudents` then renders 1000 rows; each row's `program_request` is fetched via the outer JOIN — fine — but **enrolled course tags** are derived in JS, so a college with 1000 students × N courses each does no extra queries (good), but renders large arrays per row.
- Forum `likes` / `dislikes` are stored as JSON arrays of user_ids and re-counted in code per page render.

## 9.11 `users.educations` and `biography` Stored as LONGTEXT

Both columns appear to be intended as JSON (rich text). They are typed as LONGTEXT with no JSON validation. Malformed values cause silent app errors. Should be `JSON` type.

## 9.12 Unused Tables

- `lucy_devdb.certificates` — 0 rows, no model, no references. Drop.
- `lucy_devdb.settings` — 0 rows, no references. Drop.
- `lms_admin.seo_fields` — 0 rows; model exists but is barely wired.

## 9.13 No Audit Trail

There is no `audit_log` or equivalent. Who deleted that student? Who changed that course's price? Currently unknowable.

## 9.14 No Soft Deletes

`paranoid: true` is not set on any model. Deletes are hard. Mistaken deletes are unrecoverable without restoring from RDS snapshot.

## 9.15 Scalability Concerns

| Concern | Severity | Note |
|---|---|---|
| Dual-write across two databases without transactions | High | Pre/post-assessment, program-request, certificate flows all do dual writes. Partial failure leaves the system inconsistent. |
| `lesson_watch_progress` writes on every player heartbeat | Medium | Currently rate-limited client-side. At scale, becomes a write-hot table. Consider Redis with periodic flush. |
| Watch store hydrates *entire* `lesson_completions` + `lesson_watch_progress` into memory on admin-service boot | Medium-High | Memory grows linearly with total learners. Tens of thousands of users will blow the heap. Replace with on-demand fetch. |
| Cold start adds 9 `DESCRIBE` + conditional ALTER calls | Low | Adds ~1-2s to admin-service boot but ensures schema parity. Acceptable in dev, remove from prod once migrations are in place. |
| File uploads on local disk | Medium | Doesn't survive container restarts. Move to S3. |

## 9.16 Naming Inconsistencies

| Pattern | `lucy_devdb` | `lms_admin` |
|---|---|---|
| Identifier case | camelCase (`userId`, `clgId`, `createdAt`) | snake_case (`user_id`, `created_at`) |
| Timestamps | `createdAt`, `updatedAt` | `created_at`, `updated_at` |
| PK names | domain-specific (`userId`, `clgId`) | always `id` |
| Boolean storage | `TINYINT(1)` consistently | `TINYINT(1)` consistently |

This split is intentional (two services with different conventions) but increases cognitive load for any developer working across both.

---

# 10. Recommendations

> **Priority levels:** **P0** = data-correctness or security issue, fix this week. **P1** = clear technical debt with growing cost, fix this quarter. **P2** = nice-to-have, fix when convenient.

## 10.1 Data Correctness & Security (P0)

1. **Widen `lms_admin.quiz_submissions.user_id` from INT to BIGINT.** Active bug; production userIds overflow. (§9.5)
2. **Drop the 6 duplicate UNIQUE indexes on `users.email` (`email_2` through `email_7`).** Saves storage, reduces write amplification. (§9.1)
3. **Stop storing `refreshToken` in plaintext.** Hash at rest, or move to a dedicated session/token store with appropriate access controls. (§9.6)
4. **Rotate default seed passwords.** Force change-on-first-login or remove default values from `seedRootAdmin.js` / `seedAdmin.js`. (§6.3)
5. **Wrap dual-writes in transactions where possible.** Pre/post-assessment dual-write (auth DB + admin DB) cannot be transactional, but the program-request → users-mirror writes within `lucy_devdb` can and should be.

## 10.2 Schema Hygiene (P1)

6. **Adopt a migration runner.** `sequelize-cli` or Umzug. Convert the 9 boot-time ALTER blocks in `admin-service/server.js` to numbered migrations. Stop running `sync()` in production. (§9.2)
7. **Delete unused tables:** `lucy_devdb.certificates`, `lucy_devdb.settings`, optionally `lms_admin.seo_fields`. (§9.12)
8. **Consolidate duplicate models:** `payment-service` should not define its own `College` and `Branch` — import from `college-service` or expose them through a service-to-service API. (§9.4)
9. **Rename `lms_admin.users.password` → `password_hash`.** Misleading name. (§9.7)
10. **Re-type `users.educations` and `users.biography` from LONGTEXT to JSON.** Get validation for free. (§9.11)

## 10.3 Indexes & Performance (P1)

11. Add indexes to: `lms_admin.certificates(user_id, status)`, `lms_admin.quiz_submissions(user_id, quiz_id)`, `lms_admin.live_classes(course_id)`, `lms_admin.live_classes(class_date_and_time)`, `lms_admin.questions(quiz_id)`, `lms_admin.coupons(expiry)`, `lucy_devdb.users(collegeId)`. (§9.8)
12. **Replace the in-memory `watchStore` with on-demand fetch + Redis cache.** Boot-time full-table load won't scale. (§9.15)

## 10.4 Architecture (P1)

13. **Add database-level FKs within each DB.** No physical FK exists for `categories.parent_id` → wait, it does. Add for `sections.course_id` → already exists. Add the rest where both tables live in the same DB.
14. **Document the cross-DB references explicitly.** A `docs/cross-db-references.md` listing every logical FK across the `lucy_devdb` ↔ `lms_admin` boundary, so engineers know to update both sides when deleting a user/college.
15. **Move file uploads off local disk to S3.** Currently `admin-service/uploads/` is a single point of failure and doesn't survive container restarts. (§9.15)

## 10.5 Operational Improvements (P2)

16. **Soft deletes (`paranoid: true`) on the high-value tables:** `users`, `colleges`, `courses`, `certificates`. (§9.14)
17. **Add an `audit_log` table** with `(actor_user_id, action, entity_table, entity_id, payload_json, created_at)`. Wire admin-service mutating endpoints to write to it. (§9.13)
18. **Capture connection pool metrics.** Log pool size, in-use, waiting, and slow queries to surface contention before users feel it.
19. **Run `mysqldump` snapshots into S3 daily.** RDS automatic snapshots help; logical dumps are easier to diff and restore selectively.
20. **Standardize timestamp defaults.** Either fully Sequelize-managed or fully MySQL `CURRENT_TIMESTAMP` defaults — not the current mix. (§9.9)

---

## Appendix A — File Index

### Configuration
- `backend/auth-service/src/db/index.js`
- `backend/admin-service/src/config/database.js`, `authDatabase.js`, `assessmentDatabase.js`, `env.js`
- `backend/assessment-service/src/db/index.js`
- `backend/college-service/src/db/sequelize.js`
- `backend/course-service/src/db/index.js`
- `backend/organization-service/src/db/index.js`
- `backend/payment-service/src/db/sequelize.js`

### Models (~33 total)
- **auth-service:** `User.js`, `Role.js`
- **assessment-service:** `Assessment.js`, `Question.js`, `QuestionSet.js`, `PreAssessmentRegistration.js`
- **college-service:** `College.js`, `Branch.js`
- **course-service:** `Course.js`, `Enrollment.js`
- **organization-service:** `Organization.js`
- **payment-service:** `College.js`, `Branch.js` (duplicates)
- **admin-service:** `Batch.js`, `BatchMember.js`, `Category.js`, `Certificate.js`, `College.js`, `Coupon.js`, `Course.js`, `Forum.js`, `ForumReport.js`, `Language.js`, `Lesson.js`, `LessonCompletion.js`, `LessonWatchProgress.js`, `LiveClass.js`, `PreAssessmentResult.js`, `Program.js`, `Question.js`, `QuizSubmission.js`, `Section.js`, `SeoField.js`, `Setting.js`, `User.js`, `UserProgress.js`, `index.js`

### Migrations
- `backend/auth-service/src/db/migrations/20260421-add-academic-info-to-users.{js,sql}`
- `backend/course-service/src/db/migrations/20260515-add-clgIds-to-courses.{js,sql}`
- `backend/course-service/src/db/migrations/20260516-add-teacherId-to-courses.js`

### Seeders
- `backend/auth-service/src/scripts/seedAdmin.js`
- `backend/auth-service/src/scripts/seedCollegeAdmin.js`
- `backend/admin-service/src/scripts/seedRootAdmin.js`
- `backend/admin-service/src/scripts/seedCollegeAdmin.js`

### Boot-time DDL
- `backend/admin-service/src/server.js` (lines 418–584)

### Schema sync script
- `backend/admin-service/src/scripts/syncSchema.js`

### Repositories (admin-service)
- `backend/admin-service/src/repositories/` — 14 repository files (Category, Certificate, Coupon, Course, Dashboard, Language, Lesson, LiveClass, Program, Question, QuizSubmission, Section, SeoField, Setting, User)

### Services with raw SQL (76 occurrences across 21 files)
Most concentrated in:
- `admin-service/src/services/StudentService.js` (22 occurrences)
- `admin-service/src/services/TeacherService.js` (9)
- `admin-service/src/course-content/PublicCourseService.js` (4)
- `admin-service/src/services/BatchService.js`, `CollegeDashboardService.js`, `CollegeService.js`, `CourseService.js`, `LiveClassService.js` (2-3 each)

---

*End of document.*
