// Pure decision logic for the teacher-delegation feature — NO database, NO
// network, NO Sequelize. Everything here is a deterministic function of its
// inputs so it can be unit-tested in isolation (see tests/teachingLogic.test.js).
// The DB-bound service (TeachingAssignmentService) and the course player
// (PublicCourseService) compose these helpers around their queries.

// Active releases visible *now*: a release counts only when it isn't revoked
// and its released_at is in the past (a future released_at = scheduled drip,
// still hidden). Returns a Set<number> of lesson ids.
const activeReleasedLessonIds = (releases = [], now = new Date()) => {
    const set = new Set();
    const t = now.getTime();
    for (const r of releases) {
        if (r.revoked_at) continue;
        if (r.released_at != null) {
            const at = new Date(r.released_at).getTime();
            if (Number.isFinite(at) && at > t) continue; // scheduled for later
        }
        set.add(Number(r.lesson_id));
    }
    return set;
};

// Distinct assignment ids from membership-match rows (which assignments include
// a given student). Pure dedupe.
const matchedAssignmentIds = (memberRows = []) =>
    [...new Set(memberRows.map((m) => m.teaching_assignment_id))];

// "One teacher per student per course": given the student ids about to be added
// and the rosters (Set<string>) already owned by OTHER assignments of the same
// course, return the conflicting ids (those already owned elsewhere).
const findRosterConflicts = (candidateIds = [], otherRosterSets = []) => {
    const candidate = new Set(candidateIds.map(String));
    const conflicts = new Set();
    for (const owned of otherRosterSets) {
        for (const uid of owned) if (candidate.has(String(uid))) conflicts.add(String(uid));
    }
    return [...conflicts];
};

// THE security-critical gate. Given what the student may see (released ∪ free),
// every lesson in the course, and the lesson currently being opened, decide:
//   - lockedLessonIds: every lesson the student may NOT see (merged with any
//     locks already computed by drip), and
//   - stripCurrent: whether the currently-opened lesson must have its media
//     (video src / attachment / quiz) withheld.
// A lesson is visible iff it's released to the student OR marked free.
const computeGating = ({
    visibleLessonIds = new Set(),
    freeLessonIds = [],
    allLessonIds = [],
    currentLessonId = null,
    alreadyLocked = [],
} = {}) => {
    const visible = new Set([...visibleLessonIds].map(Number));
    const free = new Set([...freeLessonIds].map(Number));
    const isVisible = (id) => visible.has(Number(id)) || free.has(Number(id));

    const locked = new Set(alreadyLocked.map(Number));
    for (const id of allLessonIds) {
        if (!isVisible(id)) locked.add(Number(id));
    }
    const stripCurrent = currentLessonId != null && !isVisible(currentLessonId);
    return { lockedLessonIds: [...locked], stripCurrent };
};

module.exports = {
    activeReleasedLessonIds,
    matchedAssignmentIds,
    findRosterConflicts,
    computeGating,
};
