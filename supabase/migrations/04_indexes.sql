-- =============================================================================
-- YagnaTech LMS — Supabase / Postgres schema bootstrap
-- File 04: indexes
-- Adds the missing indexes called out in DATABASE.md §9.1 + §10.2.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- lucy_devdb.users — hot dashboard/list filters
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role_id    ON lucy_devdb.users ("roleId");
CREATE INDEX IF NOT EXISTS idx_users_college_id ON lucy_devdb.users ("collegeId");
CREATE INDEX IF NOT EXISTS idx_users_org_id     ON lucy_devdb.users ("orgId");
CREATE INDEX IF NOT EXISTS idx_users_branch_id  ON lucy_devdb.users ("branchId");

-- -----------------------------------------------------------------------------
-- lucy_devdb.courses — instructor list, college filter
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON lucy_devdb.courses ("instructorId");
CREATE INDEX IF NOT EXISTS idx_courses_clg_ids_gin   ON lucy_devdb.courses USING GIN ("clgIds");

-- -----------------------------------------------------------------------------
-- lucy_devdb.enrollments
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id   ON lucy_devdb.enrollments ("userId");
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON lucy_devdb.enrollments ("courseId");

-- -----------------------------------------------------------------------------
-- lucy_devdb.pre_assessment_registrations (matches Sequelize indexes)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_par_user_id           ON lucy_devdb.pre_assessment_registrations ("userId");
CREATE INDEX IF NOT EXISTS idx_par_email             ON lucy_devdb.pre_assessment_registrations ("email");
CREATE INDEX IF NOT EXISTS idx_par_selected_program  ON lucy_devdb.pre_assessment_registrations ("selectedProgram");
CREATE INDEX IF NOT EXISTS idx_par_assessment_status ON lucy_devdb.pre_assessment_registrations ("assessmentStatus");

-- -----------------------------------------------------------------------------
-- lms_admin.courses — public detail page lookup key
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_courses_slug ON lms_admin.courses (slug)
  WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lms_courses_category_id ON lms_admin.courses (category_id);
CREATE INDEX IF NOT EXISTS idx_lms_courses_user_id     ON lms_admin.courses (user_id);
CREATE INDEX IF NOT EXISTS idx_lms_courses_clg_ids_gin ON lms_admin.courses USING GIN (clg_ids);

-- -----------------------------------------------------------------------------
-- lms_admin.categories
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_categories_parent_id   ON lms_admin.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_lms_categories_clg_ids_gin ON lms_admin.categories USING GIN (clg_ids);

-- -----------------------------------------------------------------------------
-- lms_admin.sections / lessons
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_sections_course_id ON lms_admin.sections (course_id);
CREATE INDEX IF NOT EXISTS idx_lms_lessons_course_id  ON lms_admin.lessons (course_id);
CREATE INDEX IF NOT EXISTS idx_lms_lessons_section_id ON lms_admin.lessons (section_id);

-- -----------------------------------------------------------------------------
-- lms_admin.certificates — enforce one cert per (user, course)
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_certificates_user_course
  ON lms_admin.certificates (user_id, course_id)
  WHERE user_id IS NOT NULL AND course_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- lms_admin.pre_assessment_results — composite filter
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_par_results_user_program
  ON lms_admin.pre_assessment_results (user_id, program_id);

-- -----------------------------------------------------------------------------
-- lms_admin.user_progress
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_user_progress_user_id ON lms_admin.user_progress (user_id);

-- -----------------------------------------------------------------------------
-- lms_admin.lesson_completions / lesson_watch_progress — common scans
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_lesson_completions_user_course
  ON lms_admin.lesson_completions (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lms_lesson_watch_user_course
  ON lms_admin.lesson_watch_progress (user_id, course_id);

-- -----------------------------------------------------------------------------
-- lms_admin.forums / forum_reports
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_forums_course_id ON lms_admin.forums (course_id);
CREATE INDEX IF NOT EXISTS idx_lms_forums_parent_id ON lms_admin.forums (parent_id);
CREATE INDEX IF NOT EXISTS idx_lms_forums_user_id   ON lms_admin.forums (user_id);

-- -----------------------------------------------------------------------------
-- lms_admin.coupons
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_coupons_user_id ON lms_admin.coupons (user_id);

-- -----------------------------------------------------------------------------
-- lms_admin.live_classes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_live_classes_user_id   ON lms_admin.live_classes (user_id);
CREATE INDEX IF NOT EXISTS idx_lms_live_classes_course_id ON lms_admin.live_classes (course_id);

-- -----------------------------------------------------------------------------
-- lms_admin.quiz_submissions
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_quiz_submissions_quiz_id ON lms_admin.quiz_submissions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_lms_quiz_submissions_user_id ON lms_admin.quiz_submissions (user_id);

-- -----------------------------------------------------------------------------
-- lms_admin.questions
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lms_questions_quiz_id ON lms_admin.questions (quiz_id);
