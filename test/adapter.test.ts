// Growing Minds Academy — Database Adapter Unit & Fail-Closed Suite
//
// Two guarantees are covered here:
//
//   1. Deterministic identifier resolution — the mapping used to translate the
//      human-readable identifiers the UI works with into stable UUID primary keys
//      is deterministic and valid RFC 4122 shaped.
//   2. Fail-closed persistence — with no database configured, every read and write
//      refuses to run. The adapter must never serve or persist local/mock fallback
//      records, because a silent fallback would let the UI believe data was saved.

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

import assert from 'node:assert/strict';

const { databaseAdapter, resolveUUID, isValidUUID, SEED_ID_MAP, questionDbId } = await import(
  '../server/db/databaseAdapter.js'
);

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`• Testing: ${name}... `);
    await fn();
    console.log(`\x1b[32mPASSED\x1b[0m`);
    passed++;
  } catch (err) {
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(err);
    failed++;
  }
}

async function runAdapterTests() {
  console.log(`\n======================================================`);
  console.log(` Growing Minds Academy — Database Adapter Unit Tests `);
  console.log(`======================================================\n`);

  // 1. UUID Resolution & Validation
  await test('resolveUUID correctly maps seed codes and generates stable valid UUIDs', async () => {
    assert.equal(isValidUUID('10000000-0000-0000-0000-000000000001'), true);
    assert.equal(isValidUUID('subj-math'), false);

    assert.equal(resolveUUID('subj-math'), SEED_ID_MAP['subj-math']);
    assert.equal(resolveUUID('cls-3a'), SEED_ID_MAP['cls-3a']);

    const generated = resolveUUID('custom-non-uuid-string');
    assert.equal(isValidUUID(generated), true, 'Generated identifiers must be valid UUIDs');
    assert.equal(
      generated,
      resolveUUID('custom-non-uuid-string'),
      'Identifier resolution must be deterministic for identical inputs'
    );
    assert.notEqual(generated, resolveUUID('another-value'), 'Distinct inputs must map to distinct UUIDs');
  });

  // 2. Fail-closed reads: no local/mock fallback data
  await test('getQuizzes refuses to return fallback records when storage is unavailable', async () => {
    await assert.rejects(
      () => databaseAdapter.getQuizzes(),
      /Supabase is not configured/,
      'Quiz reads must fail rather than serve local fallback data'
    );
  });

  await test('getQuizById refuses to return a fallback record when storage is unavailable', async () => {
    await assert.rejects(
      () => databaseAdapter.getQuizById('quiz-1'),
      /Supabase is not configured/
    );
  });

  await test('getSubmissions refuses to return fallback records when storage is unavailable', async () => {
    await assert.rejects(
      () => databaseAdapter.getSubmissions(),
      /Supabase is not configured/
    );
  });

  await test('getSubmissionByHash refuses to report a fallback match when storage is unavailable', async () => {
    await assert.rejects(
      () => databaseAdapter.getSubmissionByHash('any-hash'),
      /Supabase is not configured/
    );
  });

  // 3. Fail-closed writes: never pretend to persist
  await test('saveQuiz refuses to write locally and never returns a fabricated quiz', async () => {
    let result: unknown = 'not-called';
    await assert.rejects(async () => {
      result = await databaseAdapter.saveQuiz({
        id: 'quiz-fallback-test',
        title: 'Should never be persisted locally',
        grade: 'Grade 3',
        classId: 'cls-3a',
        className: 'Grade 3A',
        subjectId: 'subj-sci',
        subjectName: 'Integrated Science',
        topicsCovered: ['Forces'],
        questions: [],
        status: 'draft',
        releasePolicy: 'manual',
        allowOffline: true,
        maxAttempts: 1,
        authorId: 'author-1',
        authorName: 'Test Author',
        createdAt: new Date().toISOString(),
      } as never);
    }, /Supabase is not configured/);

    assert.equal(result, 'not-called', 'Save must reject so callers cannot mistake a failure for success');
  });

  await test('saveSubmission refuses to write locally when storage is unavailable', async () => {
    await assert.rejects(
      () =>
        databaseAdapter.saveSubmission({
          id: 'sub-fallback-test',
          quizId: 'quiz-1',
          quizTitle: 'Test',
          subjectName: 'Mathematics',
          learnerId: 'GMA-2026-9999',
          learnerName: 'Test Learner',
          classId: 'cls-3a',
          className: 'Grade 3A',
          answers: {},
          score: 0,
          totalMarks: 0,
          percentage: 0,
          status: 'submitted',
          syncStatus: 'pending',
          isOfflineSubmission: true,
          clientSubmissionHash: 'fallback-hash',
          submittedAt: new Date().toISOString(),
        } as never),
      /Supabase is not configured/
    );
  });

  // 4. Question DB id derivation — must be unique per quiz even when the
  //    caller reuses the same app-level question id across different quizzes.
  //    Regression guard for the questions_pkey duplicate-key crash: two quizzes
  //    both using question id "tq-1" must produce distinct question primary keys.
  await test('questionDbId produces distinct primary keys for the same question id across quizzes', async () => {
    const quizA = 'aaaaaaaa-0000-0000-0000-000000000001';
    const quizB = 'bbbbbbbb-0000-0000-0000-000000000002';
    const reusedQId = 'tq-1';

    const idA = questionDbId(quizA, reusedQId);
    const idB = questionDbId(quizB, reusedQId);

    assert.equal(isValidUUID(idA), true, 'questionDbId must return a valid UUID');
    assert.equal(isValidUUID(idB), true, 'questionDbId must return a valid UUID');
    assert.notEqual(idA, idB, 'the SAME reused question id in two different quizzes MUST map to distinct DB ids (questions_pkey uniqueness)');
    // Deterministic: same inputs always produce the same id
    assert.equal(questionDbId(quizA, reusedQId), idA, 'questionDbId must be deterministic for identical inputs');
    // Distinct question ids in the same quiz must also differ
    assert.notEqual(questionDbId(quizA, 'tq-1'), questionDbId(quizA, 'tq-2'));
  });

  await test('questionDbId preserves a caller-supplied valid UUID verbatim', async () => {
    const realUuid = '12345678-1234-4321-8765-987654321abc';
    assert.equal(questionDbId('any-quiz-id', realUuid), realUuid, 'A real UUID question id must be stored as-is (frontend generates unique UUIDs)');
  });

  console.log(`\n------------------------------------------------------`);
  console.log(`Adapter Tests Completed: ${passed} passed, ${failed} failed`);
  console.log(`------------------------------------------------------\n`);

  if (failed > 0) process.exit(1);
}

runAdapterTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
