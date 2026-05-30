-- =============================================================================
-- YagnaTech LMS — Supabase / Postgres schema bootstrap
-- File 05: seed lookup data
-- Mirrors auth-service initDb() which seeds the 4 roles on every boot
-- (DATABASE.md §6.1). Idempotent.
-- =============================================================================

INSERT INTO lucy_devdb.roles ("roleId", "role") VALUES
  ('role_student',    'student'),
  ('role_teacher', 'teacher'),
  ('role_admin',      'admin'),
  ('role_auditor',    'auditor')
ON CONFLICT ("roleId") DO NOTHING;
