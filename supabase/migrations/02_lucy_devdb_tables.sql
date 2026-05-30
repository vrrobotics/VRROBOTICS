-- =============================================================================
-- YagnaTech LMS — Supabase / Postgres schema bootstrap
-- File 02: lucy_devdb tables (identity + catalog + org tree + assessments)
-- =============================================================================
-- Ordering respects FK dependencies:
--   roles -> users -> (everything that references users)
--   organisations -> colleges -> branches
--   questionsets -> assessments
-- Cross-schema logical FKs (to lms_admin) are NOT enforced at DB layer
-- (matches the current app contract — admin-service enforces in service code).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- roles  (lookup; seeded at app boot)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.roles (
  "roleId"  VARCHAR(255) PRIMARY KEY,
  "role"    lucy_devdb.role_enum NOT NULL
  -- timestamps: false in Sequelize model
);

-- -----------------------------------------------------------------------------
-- organisations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.organisations (
  "orgId"      VARCHAR(255) PRIMARY KEY,
  "accesskey"  VARCHAR(255) NOT NULL UNIQUE,
  "orgName"    VARCHAR(255) NOT NULL,
  "orgState"   VARCHAR(255),
  "orgCountry" VARCHAR(255),
  "orgAddress" TEXT,
  "orgPin"     VARCHAR(255),
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- colleges
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.colleges (
  "clgId"      VARCHAR(255) PRIMARY KEY,
  "accesskey"  VARCHAR(255) NOT NULL UNIQUE,
  "clgName"    VARCHAR(255) NOT NULL,
  "clgAddress" TEXT,
  "orgId"      VARCHAR(255)
    REFERENCES lucy_devdb.organisations ("orgId") ON UPDATE CASCADE ON DELETE SET NULL,
  "branchIds"  JSONB DEFAULT '[]'::jsonb,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- branches  (timestamps: false)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.branches (
  "branchId"   VARCHAR(255) PRIMARY KEY,
  "branchName" VARCHAR(255) NOT NULL UNIQUE
);

-- -----------------------------------------------------------------------------
-- users  (canonical identity table)
-- Includes:
--   * boot-time ALTERs from admin-service (teacherPhoto, studentPhoto)
--   * undeclared columns written via raw SQL (assignedProgram,
--     programResponseStatus, programRespondedAt) -- promoted to first-class
--     here per DATABASE.md §5.5.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.users (
  "userId"                VARCHAR(255) PRIMARY KEY,
  "name"                  VARCHAR(255) NOT NULL,
  "email"                 VARCHAR(255) NOT NULL UNIQUE,
  "passwordHash"          VARCHAR(255) NOT NULL,
  "phone"                 VARCHAR(255),
  "dob"                   DATE,
  "gender"                lucy_devdb.gender_enum,
  "yearOfEducation"       VARCHAR(255),
  "branchId"              VARCHAR(255),
  "collegeId"             VARCHAR(255),
  "yearOfStudy"           INTEGER,
  "educationLevel"        lucy_devdb.education_level_enum,
  "branch"                VARCHAR(255),
  "collegeName"           VARCHAR(255),
  "graduationYear"        VARCHAR(255),
  "collegeCode"           VARCHAR(255),
  "orgId"                 VARCHAR(255),
  "assessmentId"          VARCHAR(255),
  "programInterested"     VARCHAR(255),
  "expertise"             VARCHAR(255),
  "bio"                   VARCHAR(1000),
  "yearsOfExperience"     INTEGER,
  "linkedinUrl"           VARCHAR(255),
  "profileStatus"         lucy_devdb.profile_status_enum DEFAULT 'pending',
  "location"              VARCHAR(255),
  "address"               VARCHAR(255),
  "lastLogin"             TIMESTAMPTZ,
  "preScore"              INTEGER,
  "preScoreDuration"      INTEGER,
  "postScore"             INTEGER,
  "postScoreDuration"     INTEGER,
  "refreshToken"          VARCHAR(1024),
  "roleId"                VARCHAR(255) NOT NULL
    REFERENCES lucy_devdb.roles ("roleId") ON UPDATE CASCADE ON DELETE RESTRICT,
  "assignedProgram"       VARCHAR(255),
  "programResponseStatus" VARCHAR(255),
  "programRespondedAt"    TIMESTAMPTZ,
  "teacherPhoto"       VARCHAR(255),
  "studentPhoto"          VARCHAR(255),
  -- Per-user quiz state: JSONB object keyed by quiz_id. Each slot stores
  -- { score, total, attempts, lastAttemptAt }. Written by PublicCourseService
  -- on every quiz submit. NULL until the user takes their first quiz.
  "quizScores"            JSONB,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- courses  (course-service flavor — distinct from lms_admin.courses)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.courses (
  "courseId"               VARCHAR(255) PRIMARY KEY,
  "title"                  VARCHAR(255) NOT NULL,
  "description"            TEXT,
  "duration"               INTEGER NOT NULL,
  "isPreAssessmentNeeded"  BOOLEAN DEFAULT FALSE,
  "modules"                JSONB,
  "clgIds"                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  "teacherId"           VARCHAR(255),
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- enrollments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.enrollments (
  "enrollmentId" VARCHAR(255) PRIMARY KEY,
  "userId"       VARCHAR(255) NOT NULL,
  "courseId"     VARCHAR(255) NOT NULL
    REFERENCES lucy_devdb.courses ("courseId") ON UPDATE CASCADE ON DELETE RESTRICT,
  "status"       lucy_devdb.enrollment_status_enum NOT NULL DEFAULT 'enrolled',
  "enrolledAt"   TIMESTAMPTZ DEFAULT now(),
  "completedAt"  TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- questionsets  (parent of assessments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.questionsets (
  "setId"     VARCHAR(255) PRIMARY KEY,
  "setName"   VARCHAR(255) NOT NULL,
  "category"  VARCHAR(255),
  "questions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- assessments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.assessments (
  "assessmentId" VARCHAR(255) PRIMARY KEY,
  "type"         lucy_devdb.assessment_type_enum NOT NULL,
  "setId"        VARCHAR(255) NOT NULL
    REFERENCES lucy_devdb.questionsets ("setId") ON UPDATE CASCADE ON DELETE RESTRICT,
  "startAt"      TIMESTAMPTZ,
  "endAt"        TIMESTAMPTZ,
  "score"        REAL,
  "timer"        INTEGER,
  "status"       lucy_devdb.assessment_status_enum NOT NULL DEFAULT 'not-started',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- questions  (assessment-service flavor — distinct from lms_admin.questions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.questions (
  "quesId"           VARCHAR(255) PRIMARY KEY,
  "question"         TEXT NOT NULL,
  "correctAns"       VARCHAR(255) NOT NULL,
  "options"          JSONB NOT NULL,
  "category"         VARCHAR(255),
  "questionSeverity" lucy_devdb.question_severity_enum,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- pre_assessment_registrations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.pre_assessment_registrations (
  "registrationId"        VARCHAR(255) PRIMARY KEY,
  "userId"                VARCHAR(255),
  "fullName"              VARCHAR(120) NOT NULL CHECK (char_length("fullName") BETWEEN 2 AND 120),
  "email"                 VARCHAR(160) NOT NULL CHECK ("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  "phoneNumber"           VARCHAR(20)  NOT NULL,
  "gender"                lucy_devdb.preassess_gender_enum NOT NULL,
  -- VARCHAR not program_enum: admins create programs dynamically, so the
  -- stored title isn't limited to the canonical 3. selectedProgramId links
  -- to lms_admin.programs.id when the chosen program is an admin-created one.
  "selectedProgram"       VARCHAR(255) NOT NULL,
  "selectedProgramId"     INTEGER,
  "uploadedCollegeProof"  JSONB NOT NULL,
  "declarationAccepted"   BOOLEAN NOT NULL DEFAULT FALSE CHECK ("declarationAccepted" = TRUE),
  "assessmentStatus"      lucy_devdb.preassess_status_enum NOT NULL DEFAULT 'registered',
  "assessmentStartedAt"   TIMESTAMPTZ,
  "submittedFromIp"       VARCHAR(64),
  "submittedUserAgent"    VARCHAR(255),
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- program_requests  (was raw-SQL-only in MySQL; now first-class)
-- DATABASE.md §4.1.12 + §5.5 flagged this as a missing migration.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lucy_devdb.program_requests (
  "user_id"      VARCHAR(255) PRIMARY KEY,
  -- VARCHAR not program_enum — admin-created program titles (Manage Programs)
  -- aren't limited to the canonical 3 values.
  "program"      VARCHAR(255) NOT NULL,
  "requested_by" VARCHAR(255),
  "status"       lucy_devdb.program_request_status_enum NOT NULL DEFAULT 'sent',
  "responded_at" TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- updatedAt auto-touch trigger (Sequelize sets this in JS; mirror at DB level
-- so direct SQL / Supabase Studio writes also bump it).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lucy_devdb.touch_updated_at_camel()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION lucy_devdb.touch_updated_at_snake()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'lucy_devdb' AND column_name = 'updatedAt'
     GROUP BY table_name
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_touch_updated_at ON lucy_devdb.%I;
       CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON lucy_devdb.%I
         FOR EACH ROW EXECUTE FUNCTION lucy_devdb.touch_updated_at_camel();',
      r.table_name, r.table_name);
  END LOOP;

  FOR r IN
    SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'lucy_devdb' AND column_name = 'updated_at'
     GROUP BY table_name
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_touch_updated_at ON lucy_devdb.%I;
       CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON lucy_devdb.%I
         FOR EACH ROW EXECUTE FUNCTION lucy_devdb.touch_updated_at_snake();',
      r.table_name, r.table_name);
  END LOOP;
END $$;
