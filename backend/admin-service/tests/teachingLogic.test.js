// Unit tests for the teacher-delegation decision logic. Pure functions, no DB,
// no network — run with:  npm test   (alias for `node --test`).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    activeReleasedLessonIds,
    matchedAssignmentIds,
    findRosterConflicts,
    computeGating,
} = require('../src/services/teachingLogic');

// --- activeReleasedLessonIds ------------------------------------------------

test('activeReleasedLessonIds: includes released, excludes revoked', () => {
    const now = new Date('2026-06-04T12:00:00Z');
    const ids = activeReleasedLessonIds([
        { lesson_id: 1, released_at: '2026-06-04T09:00:00Z', revoked_at: null },
        { lesson_id: 2, released_at: '2026-06-04T09:00:00Z', revoked_at: '2026-06-04T10:00:00Z' }, // revoked
        { lesson_id: 3, released_at: '2026-06-03T09:00:00Z', revoked_at: null },
    ], now);
    assert.deepEqual([...ids].sort(), [1, 3]);
});

test('activeReleasedLessonIds: a future released_at stays hidden (scheduled)', () => {
    const now = new Date('2026-06-04T12:00:00Z');
    const ids = activeReleasedLessonIds([
        { lesson_id: 10, released_at: '2026-06-05T09:00:00Z', revoked_at: null }, // tomorrow
        { lesson_id: 11, released_at: '2026-06-04T11:59:00Z', revoked_at: null }, // 1 min ago
    ], now);
    assert.deepEqual([...ids], [11]);
});

test('activeReleasedLessonIds: empty input → empty set', () => {
    assert.equal(activeReleasedLessonIds([]).size, 0);
});

// --- matchedAssignmentIds ---------------------------------------------------

test('matchedAssignmentIds: dedupes assignment ids', () => {
    const ids = matchedAssignmentIds([
        { teaching_assignment_id: 5 },
        { teaching_assignment_id: 5 },
        { teaching_assignment_id: 9 },
    ]);
    assert.deepEqual(ids.sort(), [5, 9]);
});

// --- findRosterConflicts (one teacher per student per course) ---------------

test('findRosterConflicts: flags a student already owned elsewhere', () => {
    const conflicts = findRosterConflicts(
        ['100', '200', '300'],
        [new Set(['200']), new Set(['999'])], // 200 owned by another assignment
    );
    assert.deepEqual(conflicts, ['200']);
});

test('findRosterConflicts: none when student is free', () => {
    const conflicts = findRosterConflicts(['100', '200'], [new Set(['300']), new Set([])]);
    assert.deepEqual(conflicts, []);
});

test('findRosterConflicts: matches across string/number boundary', () => {
    // candidate numeric-string vs owned numeric — must still collide.
    const conflicts = findRosterConflicts(['100'], [new Set([100])]);
    assert.deepEqual(conflicts, ['100']);
});

// --- computeGating (THE security gate) --------------------------------------

test('computeGating: locks every un-released lesson', () => {
    const r = computeGating({
        visibleLessonIds: new Set([1, 2]),
        freeLessonIds: [],
        allLessonIds: [1, 2, 3, 4],
        currentLessonId: 3,
    });
    assert.deepEqual(r.lockedLessonIds.sort(), [3, 4]);
    assert.equal(r.stripCurrent, true, 'lesson 3 is not released → media must be stripped');
});

test('computeGating: released current lesson is NOT stripped', () => {
    const r = computeGating({
        visibleLessonIds: new Set([1, 2]),
        freeLessonIds: [],
        allLessonIds: [1, 2, 3],
        currentLessonId: 2,
    });
    assert.equal(r.stripCurrent, false);
    assert.deepEqual(r.lockedLessonIds, [3]);
});

test('computeGating: free lessons stay visible even when unreleased', () => {
    const r = computeGating({
        visibleLessonIds: new Set([1]),
        freeLessonIds: [9],
        allLessonIds: [1, 9, 5],
        currentLessonId: 9,
    });
    assert.equal(r.stripCurrent, false, 'free lesson must remain playable');
    assert.deepEqual(r.lockedLessonIds, [5]);
});

test('computeGating: nothing released → everything locked & stripped', () => {
    const r = computeGating({
        visibleLessonIds: new Set(),
        freeLessonIds: [],
        allLessonIds: [1, 2, 3],
        currentLessonId: 1,
    });
    assert.deepEqual(r.lockedLessonIds.sort(), [1, 2, 3]);
    assert.equal(r.stripCurrent, true);
});

test('computeGating: merges with drip locks without duplicating', () => {
    const r = computeGating({
        visibleLessonIds: new Set([1]),
        freeLessonIds: [],
        allLessonIds: [1, 2, 3],
        currentLessonId: 1,
        alreadyLocked: [2], // drip already locked 2
    });
    assert.deepEqual(r.lockedLessonIds.sort(), [2, 3]);
    assert.equal(r.stripCurrent, false);
});

test('computeGating: no current lesson → stripCurrent false', () => {
    const r = computeGating({
        visibleLessonIds: new Set([1]),
        freeLessonIds: [],
        allLessonIds: [1, 2],
        currentLessonId: null,
    });
    assert.equal(r.stripCurrent, false);
});
