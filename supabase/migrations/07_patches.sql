-- =============================================================================
-- YagnaTech LMS — schema patches added after the initial release.
-- Every statement is idempotent (IF NOT EXISTS) so re-running is safe.
-- =============================================================================

-- The User model in auth-service tracks how long the student spent on the
-- post-assessment (sibling of preScoreDuration). Add the column if missing.
ALTER TABLE lucy_devdb.users
  ADD COLUMN IF NOT EXISTS "postScoreDuration" INTEGER;
