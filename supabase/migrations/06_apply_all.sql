-- =============================================================================
-- YagnaTech LMS — Supabase / Postgres schema bootstrap
-- File 06: single-file orchestrator
--
-- Use this if your tool can't run a directory of files in order
-- (e.g. Supabase SQL Editor) — paste the contents of files 01..05 in this
-- order, or run via psql:
--
--   psql "$SUPABASE_DB_URL" \
--     -f 01_schemas_and_enums.sql \
--     -f 02_lucy_devdb_tables.sql \
--     -f 03_lms_admin_tables.sql \
--     -f 04_indexes.sql \
--     -f 05_seed_roles.sql
--
-- Or via the Supabase CLI from the repo root:
--
--   supabase db push
--
-- The scripts are idempotent (CREATE ... IF NOT EXISTS, ON CONFLICT DO NOTHING).
-- =============================================================================

\i 01_schemas_and_enums.sql
\i 02_lucy_devdb_tables.sql
\i 03_lms_admin_tables.sql
\i 04_indexes.sql
\i 05_seed_roles.sql
