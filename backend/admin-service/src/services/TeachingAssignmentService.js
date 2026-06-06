const { Op, QueryTypes, Transaction } = require('sequelize');
const {
    sequelize,
    TeachingAssignment,
    AssignmentMember,
    LessonRelease,
    BatchMember,
    Batch,
    Lesson,
    Course,
    LessonCompletion,
} = require('../models');
const authDb = require('../config/authDatabase');
const { HttpError } = require('../middlewares/error');
const {
    activeReleasedLessonIds,
    matchedAssignmentIds,
    findRosterConflicts,
} = require('./teachingLogic');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isAdmin = (user) => user?.role === 'admin' || user?.role === 'root';
const isRoot = (user) => user?.role === 'root';

// Normalise an id list: accept string|number|array, trim, dedupe, cast to
// string. Mirrors normIds in BatchService (student ids overflow INT).
const normIds = (raw) => {
    if (raw == null) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    const seen = new Set();
    const out = [];
    for (const v of arr) {
        const s = String(v ?? '').trim();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
};

// Resolve the FULL set of student userIds on an assignment's roster:
// expand every 'batch' member through batch_members, union every 'student'
// member. Returns a Set<string>.
const resolveRosterUserIds = async (assignmentId, tx = null) => {
    const members = await AssignmentMember.findAll({
        where: { teaching_assignment_id: assignmentId },
        raw: true,
        transaction: tx,
    });
    const out = new Set();
    const batchIds = [];
    for (const m of members) {
        if (m.member_type === 'student') out.add(String(m.member_ref));
        else if (m.member_type === 'batch') batchIds.push(Number(m.member_ref));
    }
    if (batchIds.length) {
        const bm = await BatchMember.findAll({
            where: { batch_id: { [Op.in]: batchIds } },
            attributes: ['user_id'],
            raw: true,
            transaction: tx,
        });
        for (const r of bm) out.add(String(r.user_id));
    }
    return out;
};

// Enforce "one teacher per student per course": given candidate student ids
// about to join `assignmentId` (for `courseId`), find any already owned by a
// DIFFERENT assignment of the same course. Throws 409 listing the conflicts.
const assertStudentsFree = async ({ courseId, candidateIds, excludeAssignmentId, tx = null }) => {
    if (candidateIds.length === 0) return;
    const others = await TeachingAssignment.findAll({
        where: {
            course_id: courseId,
            id: { [Op.ne]: excludeAssignmentId },
        },
        attributes: ['id'],
        raw: true,
        transaction: tx,
    });
    if (others.length === 0) return;

    const otherRosterSets = [];
    for (const a of others) otherRosterSets.push(await resolveRosterUserIds(a.id, tx));
    const conflicts = findRosterConflicts(candidateIds, otherRosterSets);
    if (conflicts.length) {
        throw new HttpError(
            409,
            `These students are already assigned to another teacher for this course: ${conflicts.join(', ')}`
        );
    }
};

// admin/root may manage any assignment; a teacher only their own.
const loadManageableAssignment = async (user, id) => {
    const a = await TeachingAssignment.findByPk(id);
    if (!a) throw new HttpError(404, 'Teaching assignment not found');
    if (isAdmin(user)) {
        // College admin: only their OWN college's assignments. A null clg_id
        // means root-owned — off-limits to a college admin (previously this
        // slipped through because the check required a.clg_id to be set).
        if (!isRoot(user)) {
            if (!user.collegeId || String(a.clg_id || '') !== String(user.collegeId)) {
                throw new HttpError(403, 'This assignment belongs to another college');
            }
        }
        return a;
    }
    if (user?.role === 'teacher' && String(a.teacher_id) === String(user.userId)) return a;
    throw new HttpError(403, 'You do not manage this assignment');
};

// Resolve teacher/student display names from the auth DB in one query.
const resolveUserNames = async (userIds) => {
    const ids = normIds(userIds);
    if (!ids.length) return {};
    const rows = await authDb.query(
        `SELECT u."userId" AS id, u.name, u.email, u.phone
           FROM users u
          WHERE u."userId" IN (:ids)`,
        { replacements: { ids }, type: QueryTypes.SELECT }
    );
    return Object.fromEntries(rows.map((r) => [String(r.id), r]));
};

// ---------------------------------------------------------------------------
// Assignments (admin creates; teacher reads own)
// ---------------------------------------------------------------------------

const listAssignments = async ({ user, courseId }) => {
    const where = {};
    if (courseId) where.course_id = Number(courseId);

    if (user?.role === 'teacher') {
        where.teacher_id = String(user.userId);
    } else if (!isRoot(user) && user?.collegeId) {
        where.clg_id = String(user.collegeId);
    }

    const rows = await TeachingAssignment.findAll({
        where,
        order: [['created_at', 'DESC']],
        raw: true,
    });
    if (!rows.length) return { assignments: [] };

    // Enrich with teacher name, member count, release count — all batched.
    const ids = rows.map((r) => r.id);
    const teacherNames = await resolveUserNames(rows.map((r) => r.teacher_id));

    const memberCounts = await AssignmentMember.findAll({
        where: { teaching_assignment_id: { [Op.in]: ids } },
        attributes: ['teaching_assignment_id', 'member_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['teaching_assignment_id', 'member_type'],
        raw: true,
    });
    const releaseCounts = await LessonRelease.findAll({
        where: { teaching_assignment_id: { [Op.in]: ids }, revoked_at: null },
        attributes: ['teaching_assignment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['teaching_assignment_id'],
        raw: true,
    });
    const mc = {};
    for (const r of memberCounts) {
        mc[r.teaching_assignment_id] = mc[r.teaching_assignment_id] || { batch: 0, student: 0 };
        mc[r.teaching_assignment_id][r.member_type] = Number(r.count) || 0;
    }
    const rc = Object.fromEntries(releaseCounts.map((r) => [r.teaching_assignment_id, Number(r.count) || 0]));

    // Course titles so the UI shows the course name (not "Course #id") — works
    // for the teacher view too, where listCourses wouldn't return the course.
    const courseIds = [...new Set(rows.map((r) => r.course_id))];
    const courses = await Course.findAll({
        where: { id: { [Op.in]: courseIds } },
        attributes: ['id', 'title', 'slug'],
        raw: true,
    });
    const courseById = Object.fromEntries(courses.map((c) => [c.id, c]));

    return {
        assignments: rows.map((a) => ({
            ...a,
            teacher: teacherNames[String(a.teacher_id)] || null,
            course_title: courseById[a.course_id]?.title || null,
            course_slug: courseById[a.course_id]?.slug || null,
            batch_count: mc[a.id]?.batch || 0,
            individual_count: mc[a.id]?.student || 0,
            released_lesson_count: rc[a.id] || 0,
        })),
    };
};

const createAssignment = async ({ user, body }) => {
    if (!isAdmin(user)) throw new HttpError(403, 'Only an admin can assign a course to a teacher');
    const course_id = Number(body?.course_id);
    const teacher_id = String(body?.teacher_id ?? '').trim();
    if (!course_id) throw new HttpError(422, 'course_id is required');
    if (!teacher_id) throw new HttpError(422, 'teacher_id is required');

    const course = await Course.findByPk(course_id);
    if (!course) throw new HttpError(404, 'Course not found');

    // Confirm teacher_id is actually a teacher in the auth DB.
    const t = await authDb.query(
        `SELECT u."userId", u."collegeId"
           FROM users u JOIN roles r ON r."roleId" = u."roleId"
          WHERE u."userId" = :tid AND r.role = 'teacher' LIMIT 1`,
        { replacements: { tid: teacher_id }, type: QueryTypes.SELECT }
    );
    if (!t.length) throw new HttpError(422, 'teacher_id is not a valid teacher');

    const clg_id = body?.clg_id || user.collegeId || t[0].collegeId || null;

    // Idempotent: re-assigning the same teacher to the same course returns the
    // existing row instead of erroring on the unique index.
    const [assignment] = await TeachingAssignment.findOrCreate({
        where: { course_id, teacher_id },
        defaults: { course_id, teacher_id, clg_id, is_active: true },
    });
    return { message: 'Course assigned to teacher', assignment };
};

const deleteAssignment = async ({ user, id }) => {
    const a = await loadManageableAssignment(user, id);
    if (!isAdmin(user)) throw new HttpError(403, 'Only an admin can remove an assignment');
    await sequelize.transaction(async (tx) => {
        await LessonRelease.destroy({ where: { teaching_assignment_id: a.id }, transaction: tx });
        await AssignmentMember.destroy({ where: { teaching_assignment_id: a.id }, transaction: tx });
        await a.destroy({ transaction: tx });
    });
    return { message: 'Assignment removed' };
};

// ---------------------------------------------------------------------------
// Roster (admin adds batches / individual students)
// ---------------------------------------------------------------------------

const addMembers = async ({ user, id, body }) => {
    const a = await loadManageableAssignment(user, id);
    if (!isAdmin(user)) throw new HttpError(403, 'Only an admin can change the roster');

    const batchIds = normIds(body?.batchIds ?? body?.batch_ids);
    const studentIds = normIds(body?.studentIds ?? body?.student_ids);
    if (!batchIds.length && !studentIds.length) {
        throw new HttpError(422, 'Provide batchIds and/or studentIds');
    }

    const rows = [
        ...batchIds.map((b) => ({ teaching_assignment_id: a.id, member_type: 'batch', member_ref: String(b) })),
        ...studentIds.map((s) => ({ teaching_assignment_id: a.id, member_type: 'student', member_ref: String(s) })),
    ];

    // SERIALIZABLE so the conflict check and the insert are atomic: two admins
    // adding the same student to different teachers at the same time can't both
    // pass the "one teacher per student per course" check (one tx is rejected
    // and the caller sees the 409 / a retriable serialization error).
    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (tx) => {
        let batchStudentIds = [];
        if (batchIds.length) {
            const bm = await BatchMember.findAll({
                where: { batch_id: { [Op.in]: batchIds.map(Number) } },
                attributes: ['user_id'],
                raw: true,
                transaction: tx,
            });
            batchStudentIds = bm.map((r) => String(r.user_id));
        }
        const candidateIds = [...new Set([...studentIds, ...batchStudentIds])];
        await assertStudentsFree({ courseId: a.course_id, candidateIds, excludeAssignmentId: a.id, tx });
        await AssignmentMember.bulkCreate(rows, { ignoreDuplicates: true, transaction: tx });
    });
    return { message: 'Roster updated', added: rows.length };
};

const removeMember = async ({ user, id, body }) => {
    const a = await loadManageableAssignment(user, id);
    if (!isAdmin(user)) throw new HttpError(403, 'Only an admin can change the roster');
    const member_type = String(body?.member_type ?? '').trim();
    const member_ref = String(body?.member_ref ?? '').trim();
    if (!['batch', 'student'].includes(member_type) || !member_ref) {
        throw new HttpError(422, 'member_type (batch|student) and member_ref are required');
    }
    const n = await AssignmentMember.destroy({
        where: { teaching_assignment_id: a.id, member_type, member_ref },
    });
    return { message: n ? 'Member removed' : 'Member not found', removed: n };
};

// Full roster of an assignment with student names — what the teacher sees.
const getRoster = async ({ user, id }) => {
    const a = await loadManageableAssignment(user, id);
    const userIds = [...(await resolveRosterUserIds(a.id))];
    const byId = await resolveUserNames(userIds);
    const students = userIds.map((uid) => byId[uid] || { id: uid, name: null, email: null });

    // Also return the raw membership rows so the admin UI can show which were
    // added by batch vs individually.
    const members = await AssignmentMember.findAll({
        where: { teaching_assignment_id: a.id },
        order: [['created_at', 'ASC']],
        raw: true,
    });
    return { assignment: a, students, member_count: students.length, members };
};

// Per-student progress for the roster: how many of the RELEASED lessons each
// student has completed. Released is the right denominator — a student can only
// complete what the teacher has unlocked. Visible to admin + the owning teacher.
const getProgress = async ({ user, id }) => {
    const a = await loadManageableAssignment(user, id);

    const studentIds = [...(await resolveRosterUserIds(a.id))];
    const releaseRows = await LessonRelease.findAll({
        where: { teaching_assignment_id: a.id },
        attributes: ['lesson_id', 'released_at', 'revoked_at'],
        raw: true,
    });
    const releasedIds = [...activeReleasedLessonIds(releaseRows)];
    const totalReleased = releasedIds.length;

    const names = await resolveUserNames(studentIds);

    // Count, per student, how many released lessons they've completed.
    const completedByUser = {};
    if (studentIds.length && releasedIds.length) {
        const rows = await LessonCompletion.findAll({
            where: {
                // lesson_completions.user_id is varchar in the DB — compare as
                // strings (studentIds are already strings).
                user_id: { [Op.in]: studentIds.map(String) },
                lesson_id: { [Op.in]: releasedIds },
            },
            attributes: ['user_id'],
            raw: true,
        });
        for (const r of rows) {
            const k = String(r.user_id);
            completedByUser[k] = (completedByUser[k] || 0) + 1;
        }
    }

    const students = studentIds
        .map((uid) => {
            const completed = completedByUser[String(uid)] || 0;
            return {
                id: uid,
                name: names[uid]?.name || uid,
                email: names[uid]?.email || null,
                completed,
                total: totalReleased,
                percent: totalReleased ? Math.round((completed / totalReleased) * 100) : 0,
            };
        })
        .sort((x, y) => y.percent - x.percent);

    return { total_released: totalReleased, student_count: students.length, students };
};

// ---------------------------------------------------------------------------
// Releases (teacher's daily drip)
// ---------------------------------------------------------------------------

const listReleases = async ({ user, id }) => {
    const a = await loadManageableAssignment(user, id);
    const releases = await LessonRelease.findAll({
        where: { teaching_assignment_id: a.id },
        order: [['released_at', 'DESC']],
        raw: true,
    });
    return { releases };
};

const createReleases = async ({ user, id, body }) => {
    const a = await loadManageableAssignment(user, id);
    const lessonIds = normIds(body?.lessonIds ?? body?.lesson_ids ?? body?.lesson_id)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0);
    if (!lessonIds.length) throw new HttpError(422, 'lessonIds is required');

    // Every lesson must belong to THIS assignment's course — a teacher can't
    // release content from a course they weren't assigned.
    const valid = await Lesson.findAll({
        where: { id: { [Op.in]: lessonIds }, course_id: a.course_id },
        attributes: ['id'],
        raw: true,
    });
    const validIds = valid.map((l) => l.id);
    if (!validIds.length) throw new HttpError(422, 'No lessons match this course');

    // Optional scheduling: released_at in the future = scheduled drip.
    const releasedAt = body?.released_at ? new Date(body.released_at) : new Date();
    if (Number.isNaN(releasedAt.getTime())) throw new HttpError(422, 'released_at is invalid');

    const releasedBy = String(user.userId ?? user.id ?? '');
    let count = 0;
    for (const lessonId of validIds) {
        // Re-releasing a previously-revoked lesson re-activates it.
        const [row, created] = await LessonRelease.findOrCreate({
            where: { teaching_assignment_id: a.id, lesson_id: lessonId },
            defaults: {
                teaching_assignment_id: a.id,
                lesson_id: lessonId,
                course_id: a.course_id,
                released_by: releasedBy,
                released_at: releasedAt,
                revoked_at: null,
            },
        });
        if (!created) {
            await row.update({ released_at: releasedAt, revoked_at: null, released_by: releasedBy });
        }
        count += 1;
    }
    return { message: 'Lessons released', released: count };
};

const revokeRelease = async ({ user, id, releaseId }) => {
    const a = await loadManageableAssignment(user, id);
    const row = await LessonRelease.findOne({
        where: { id: Number(releaseId), teaching_assignment_id: a.id },
    });
    if (!row) throw new HttpError(404, 'Release not found');
    await row.update({ revoked_at: new Date() });
    return { message: 'Lesson access revoked' };
};

// ---------------------------------------------------------------------------
// Enforcement helper — used by the course player + the student "daily card".
// ---------------------------------------------------------------------------

// For a (course, student): which lessons may the student see?
//   { enforced:false }                  → course has NO teaching assignment;
//                                          caller keeps legacy behaviour.
//   { enforced:true, lessonIds:Set }    → delegated course; only these lesson
//                                          ids are released to this student.
// Anonymous / unknown students on a delegated course get an empty set.
const visibleLessonIdsForStudent = async (courseId, studentIdRaw) => {
    const cid = Number(courseId);
    if (!cid) return { enforced: false, lessonIds: new Set() };

    const assignments = await TeachingAssignment.findAll({
        where: { course_id: cid },
        attributes: ['id'],
        raw: true,
    });
    if (!assignments.length) return { enforced: false, lessonIds: new Set() };

    const studentId = String(studentIdRaw ?? '').trim();
    if (!studentId) return { enforced: true, lessonIds: new Set() };

    // Which of this course's assignments include this student?
    const assignmentIds = assignments.map((a) => a.id);
    const myBatches = await BatchMember.findAll({
        where: { user_id: studentId },
        attributes: ['batch_id'],
        raw: true,
    });
    const myBatchRefs = myBatches.map((b) => String(b.batch_id));

    const memberMatch = await AssignmentMember.findAll({
        where: {
            teaching_assignment_id: { [Op.in]: assignmentIds },
            [Op.or]: [
                { member_type: 'student', member_ref: studentId },
                ...(myBatchRefs.length ? [{ member_type: 'batch', member_ref: { [Op.in]: myBatchRefs } }] : []),
            ],
        },
        attributes: ['teaching_assignment_id'],
        raw: true,
    });
    const matchedIds = matchedAssignmentIds(memberMatch);
    if (!matchedIds.length) return { enforced: true, lessonIds: new Set() };

    // Pull releases for the matched assignments, then let the pure helper decide
    // which are visible now (not revoked, released_at in the past). Centralizing
    // the date/revoke rule in activeReleasedLessonIds keeps it unit-testable.
    const releases = await LessonRelease.findAll({
        where: { teaching_assignment_id: { [Op.in]: matchedIds } },
        attributes: ['lesson_id', 'released_at', 'revoked_at'],
        raw: true,
    });
    return { enforced: true, lessonIds: activeReleasedLessonIds(releases) };
};

// Course ids this student is delegated (on a teacher's roster via batch or
// individually). Powers the student's "My Courses" for school/batch students
// who never pay — their courses come from delegation, not enrollment/payment.
const coursesForStudent = async (studentIdRaw) => {
    const sid = String(studentIdRaw ?? '').trim();
    if (!sid) return [];
    const myBatches = await BatchMember.findAll({ where: { user_id: sid }, attributes: ['batch_id'], raw: true });
    const batchRefs = myBatches.map((b) => String(b.batch_id));
    const members = await AssignmentMember.findAll({
        where: {
            [Op.or]: [
                { member_type: 'student', member_ref: sid },
                ...(batchRefs.length ? [{ member_type: 'batch', member_ref: { [Op.in]: batchRefs } }] : []),
            ],
        },
        attributes: ['teaching_assignment_id'],
        raw: true,
    });
    const aids = [...new Set(members.map((m) => m.teaching_assignment_id))];
    if (!aids.length) return [];
    const rows = await TeachingAssignment.findAll({ where: { id: { [Op.in]: aids } }, attributes: ['course_id'], raw: true });
    return [...new Set(rows.map((r) => Number(r.course_id)))];
};

// Distinct students across ALL of a teacher's assignments (their roster, batch +
// individual), with names — powers the teacher dashboard "Students" tab.
const studentsByTeacher = async (teacherIdRaw) => {
    const tid = String(teacherIdRaw ?? '').trim();
    if (!tid) return [];
    const assignments = await TeachingAssignment.findAll({ where: { teacher_id: tid }, attributes: ['id'], raw: true });
    if (!assignments.length) return [];
    const ids = new Set();
    for (const a of assignments) {
        for (const uid of await resolveRosterUserIds(a.id)) ids.add(uid);
    }
    const idList = [...ids];
    if (!idList.length) return [];
    const names = await resolveUserNames(idList);
    // id + name only — no email (this is a teacher-self-scoped list, keep PII minimal).
    return idList.map((id) => ({ id, name: names[id]?.name || `Student ${id}` }));
};

module.exports = {
    listAssignments,
    coursesForStudent,
    studentsByTeacher,
    createAssignment,
    deleteAssignment,
    addMembers,
    removeMember,
    getRoster,
    getProgress,
    listReleases,
    createReleases,
    revokeRelease,
    resolveRosterUserIds,
    visibleLessonIdsForStudent,
};
