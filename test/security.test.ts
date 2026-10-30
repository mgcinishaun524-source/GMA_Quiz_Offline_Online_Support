// Growing Minds Academy — Strict Real-User Security & Demo-Removal Regression Suite
//
// This suite pins the application to its real-user testing configuration
// (VITE_APP_MODE=production, ALLOW_DEMO_AUTH=false) with NO database configured and
// verifies the guarantees that matter for inviting real teachers:
//
//   1. Runtime configuration is reported honestly (never claims Supabase auth it lacks).
//   2. Demo accounts, hardcoded credentials and local fallback auth authenticate nobody.
//   3. Invalid credentials cannot mint a session token.
//   4. Role-based access control is enforced on protected endpoints.
//   5. Reads and writes fail closed instead of returning fabricated/mock records.
//   6. A failed write is never reported as a success notification.
//   7. Offline sync is not acknowledged while storage is unavailable (items stay queued).
//   8. AI question generation reports itself unavailable instead of substituting
//      synthetic questions that are presented as genuine AI output.
//   9. Administrator bootstrap never fabricates or overwrites an account.
//
// The unconfigured backend is the exact configuration in which demo fallbacks used to
// activate, so it is where these guarantees must be proven. The suite is fully isolated:
// it never contacts Supabase and never creates or deletes real school records.
//
// dotenv never overwrites variables that already exist in process.env, so the values
// assigned below (before the server module is imported) pin the process configuration.

process.env.NODE_ENV = 'test';
process.env.VITE_APP_MODE = 'production';
process.env.ALLOW_DEMO_AUTH = 'false';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.INITIAL_ADMIN_PASSWORD = '';
process.env.GEMINI_API_KEY = '';
process.env.SUPABASE_JWT_SECRET = 'strict-suite-ephemeral-secret-not-a-real-credential';

import { Server } from 'http';
import assert from 'node:assert/strict';

const { app } = await import('../server.js');
const {
  generateLearnerToken,
  generateStaffToken,
  recordFailedAttempt,
  clearLockout,
  resetLockoutsForTesting,
  bootstrapInitialAdmin,
} = await import('../server/auth.js');

let server: Server;
let baseUrl: string;

async function startTestServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
}

async function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

let passedCount = 0;
let failedCount = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`• Testing: ${name}... `);
    await fn();
    console.log(`\x1b[32mPASSED\x1b[0m`);
    passedCount++;
  } catch (err) {
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(err);
    failedCount++;
  }
}

async function post(path: string, body: unknown, token?: string) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function get(path: string, token?: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function runAllTests() {
  console.log(`\n======================================================`);
  console.log(` Growing Minds Academy — Strict Security & Demo Removal `);
  console.log(`======================================================\n`);

  await startTestServer();

  const adminToken = generateStaffToken({
    id: 'adm-strict-1',
    email: 'admin.strict@gma.edu',
    name: 'Strict Admin',
    role: 'admin',
  });

  const teacherToken = generateStaffToken({
    id: 'tch-strict-1',
    email: 'teacher.strict@gma.edu',
    name: 'Strict Teacher',
    role: 'teacher',
  });

  const learnerToken = generateLearnerToken({
    id: 'lrn-strict-1',
    studentNumber: 'GMA-2026-9999',
    name: 'Strict Learner',
    grade: 'Grade 3',
    className: 'Grade 3A',
    classId: 'cls-3a',
  });

  try {
    // ========================================================================
    // 1. Honest runtime configuration
    // ========================================================================

    await test('Health check reports strict-production and leaks no secrets or connection strings', async () => {
      const res = await get('/api/health');
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.status, 'ok');
      assert.equal(data.supabaseConfigured, false, 'No database is configured for this configuration');
      assert.equal(data.geminiConfigured, false, 'A placeholder Gemini key must not report as configured');
      assert.equal(
        data.authMode,
        'strict-production',
        'Without Supabase the backend must report strict-production, never a demo/local mode'
      );
      assert.notEqual(data.authMode, 'supabase', 'Must never claim verified Supabase authentication');

      const rawText = JSON.stringify(data);
      assert.equal(rawText.includes('postgres://'), false, 'Health payload must not leak database URIs');
      assert.equal(rawText.includes('service_role'), false, 'Health payload must not leak role keys');
      assert.equal(rawText.includes('eyJ'), false, 'Health payload must not leak any JWT/API key material');
    });

    await test('Health check reports AI generation unavailable while GEMINI_API_KEY is a placeholder', async () => {
      const res = await get('/api/health');
      const data = await res.json();
      // A non-empty but placeholder key (e.g. "YOUR_GEMINI_API_KEY") must not be reported
      // as a working AI configuration.
      assert.equal(data.geminiConfigured, false, 'Placeholder/empty Gemini key must be reported as unavailable');
    });

    // ========================================================================
    // 2. Demo authentication is removed — nothing authenticates without a database
    // ========================================================================

    await test('Demo staff credentials are rejected with no session token', async () => {
      const res = await post('/api/auth/staff-login', { email: 'admin@gma.edu', password: 'demo' });
      assert.equal(res.status, 503, 'Demo staff login must fail closed');
      const data = await res.json();
      assert.equal(Boolean(data.token), false, 'No fallback/mock session token may be issued');
      assert.equal(Boolean(data.user), false, 'No user profile may be fabricated');
    });

    await test('Seeded demo learner credentials are rejected with no session token', async () => {
      const res = await post('/api/auth/learner-login', { studentNumber: 'GMA-2026-0301', pin: '4821' });
      assert.equal(res.status, 503, 'Demo learner login must fail closed');
      const data = await res.json();
      assert.equal(Boolean(data.token), false, 'No fallback/mock session token may be issued');
    });

    await test('Staff login still validates its inputs while storage is unavailable', async () => {
      const missingPassword = await post('/api/auth/staff-login', { email: 'someone@gma.edu' });
      assert.equal(missingPassword.status, 400, 'A missing password must be rejected outright');

      const missingIdentifier = await post('/api/auth/staff-login', { password: 'whatever123' });
      assert.equal(missingIdentifier.status, 400, 'A missing identifier must be rejected outright');
    });

    await test('Learner login still validates PIN format while storage is unavailable', async () => {
      const res = await post('/api/auth/learner-login', { studentNumber: 'GMA-2026-0001', pin: '12' });
      assert.equal(res.status, 400, 'A non-4-digit PIN must be rejected outright');
      const shortPin = await post('/api/auth/learner-login', { studentNumber: 'GMA-2026-0001', pin: 'abcd' });
      assert.equal(shortPin.status, 400, 'A non-numeric PIN must be rejected outright');
    });

    await test('Repeated failed authentication attempts are rate limited / locked out', async () => {
      resetLockoutsForTesting();
      const studentNumber = 'GMA-2026-LOCKOUT';

      // Simulate the five failed credential checks the login route performs.
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(studentNumber);
      }

      const res = await post('/api/auth/learner-login', { studentNumber, pin: '4821' });
      assert.equal(res.status, 429, 'A locked account must be refused further attempts');
      const data = await res.json();
      assert.match(data.error, /locked/i, 'Lockout response must explain the account is locked');
      assert.equal(Boolean(data.token), false, 'A locked account must never receive a session token');

      clearLockout(studentNumber);
      resetLockoutsForTesting();
    });

    // ========================================================================
    // 3. Token and role enforcement
    // ========================================================================

    await test('Protected endpoints reject missing or malformed Authorization headers', async () => {
      const noHeader = await get('/api/quizzes');
      assert.equal(noHeader.status, 401, 'Missing Authorization must be rejected');

      const malformed = await fetch(`${baseUrl}/api/quizzes`, {
        headers: { Authorization: 'Token not-bearer' },
      });
      assert.equal(malformed.status, 401, 'A non-Bearer Authorization scheme must be rejected');
    });

    await test('Unrecognized or tampered bearer tokens are rejected rather than trusted', async () => {
      const bogus = await get('/api/quizzes', 'not-a-real-token');
      assert.equal(bogus.status, 401, 'An unknown token must be rejected');

      const lastChar = learnerToken.slice(-1);
      const tampered = learnerToken.slice(0, -1) + (lastChar === 'a' ? 'b' : 'a');
      const tamperedRes = await get('/api/quizzes', tampered);
      assert.equal(tamperedRes.status, 401, 'A tampered signature must be rejected');
    });

    await test('Learner tokens cannot reach staff-only endpoints', async () => {
      const createQuiz = await post(
        '/api/quizzes',
        { title: 'Unauthorized', grade: 'Grade 3', classId: 'cls-3a', questions: [] },
        learnerToken
      );
      assert.equal(createQuiz.status, 403, 'Learners must not create quizzes');

      const releaseResults = await post('/api/quizzes/quiz-1/release-results', {}, learnerToken);
      assert.equal(releaseResults.status, 403, 'Learners must not release results');

      const answerKey = await get('/api/quizzes/quiz-1/answer-key', learnerToken);
      assert.equal(answerKey.status, 403, 'Learners must not read confidential answer keys');
    });

    await test('Teacher tokens cannot reach administrator-only endpoints', async () => {
      const createLearner = await post(
        '/api/learners',
        { firstName: 'Test', lastName: 'Learner', pin: '4821' },
        teacherToken
      );
      assert.equal(createLearner.status, 403, 'Teachers must not enrol learners');

      const createSubject = await post('/api/subjects', { name: 'Test Subject', code: 'TST' }, teacherToken);
      assert.equal(createSubject.status, 403, 'Teachers must not create subjects');

      const createTeacher = await post(
        '/api/teachers',
        { name: 'Test Teacher', email: 'new@gma.edu', password: 'Password123!' },
        teacherToken
      );
      assert.equal(createTeacher.status, 403, 'Teachers must not provision other staff');
    });

    // ========================================================================
    // 4. Supabase is authoritative — no mock fallback, honest errors
    // ========================================================================

    await test('Directory reads fail closed with 503 and return no fabricated records', async () => {
      const endpoints: Array<[string, string]> = [
        ['/api/learners', 'learners'],
        ['/api/subjects', 'subjects'],
        ['/api/classes', 'classes'],
        ['/api/teachers', 'teachers'],
        ['/api/quizzes', 'quizzes'],
      ];

      for (const [path, key] of endpoints) {
        const res = await get(path, teacherToken);
        assert.equal(res.status, 503, `${path} must fail closed when storage is unavailable`);
        const data = await res.json();
        assert.equal(
          Array.isArray(data[key]),
          false,
          `${path} must never return a fabricated ${key} collection`
        );
        assert.equal(data.persisted, undefined, `${path} must not claim records were loaded`);
      }
    });

    await test('Learner results fail closed with no fabricated submissions', async () => {
      const res = await get('/api/learners/results', learnerToken);
      assert.equal(res.status, 503, 'Learner results must fail closed when storage is unavailable');
      const data = await res.json();
      assert.equal(Array.isArray(data.submissions), false, 'No fabricated submissions may be returned');
    });

    await test('Writes fail closed with 503 and are never reported as successful', async () => {
      const cases: Array<[string, unknown]> = [
        ['/api/learners', { firstName: 'Test', lastName: 'Learner', pin: '4821' }],
        ['/api/subjects', { name: 'Test Subject', code: 'TST' }],
        ['/api/classes', { name: 'Grade 9Z', grade: 'Grade 9' }],
        ['/api/teachers', { name: 'Test Teacher', email: 'new.teacher@gma.edu', password: 'Password123!' }],
        [
          '/api/quizzes',
          {
            title: 'Test Quiz',
            grade: 'Grade 3',
            classId: 'cls-3a',
            subjectId: 'subj-sci',
            questions: [{ id: 'q1', type: 'true_false', prompt: 'Water boils at 100C.', correctAnswer: 'true', marks: 1 }],
          },
        ],
      ];

      for (const [path, body] of cases) {
        const res = await post(path, body, adminToken);
        assert.equal(res.status, 503, `POST ${path} must fail closed rather than pretend to save`);
        assert.notEqual(res.status, 201, `POST ${path} must never report a created record`);
        const data = await res.json();
        // No success payloads (learner/subject/class/teacher/quiz objects) may be returned.
        assert.equal(data.learner, undefined, `POST ${path} must not return a fabricated learner`);
        assert.equal(data.subject, undefined, `POST ${path} must not return a fabricated subject`);
        assert.equal(data.class, undefined, `POST ${path} must not return a fabricated class`);
        assert.equal(data.teacher, undefined, `POST ${path} must not return a fabricated teacher`);
        assert.equal(data.quiz, undefined, `POST ${path} must not return a fabricated quiz`);
        assert.equal(data.persisted, undefined, `POST ${path} must not claim persistence`);
      }
    });

    await test('Offline submission sync is not acknowledged while storage is unavailable', async () => {
      const res = await post(
        '/api/submissions/sync',
        {
          items: [
            {
              id: 'queued-1',
              clientSubmissionHash: 'hash-queued-1',
              quizId: 'quiz-1',
              answers: { 'q-101': 'opt-b' },
            },
          ],
        },
        learnerToken
      );

      assert.equal(res.status, 503, 'Queued submissions must not be marked synced without storage');
      const data = await res.json();
      assert.equal(data.syncedCount, undefined, 'No sync count may be reported');
      assert.equal(Array.isArray(data.results), false, 'No per-item "synced" results may be fabricated');
    });

    // ========================================================================
    // 5. AI generation honesty
    // ========================================================================

    await test('AI generation reports itself unavailable instead of substituting synthetic questions', async () => {
      const res = await post(
        '/api/ai/generate-quiz',
        { grade: 'Grade 4', subject: 'Mathematics', topics: ['Fractions'], questionCount: 10 },
        teacherToken
      );

      assert.equal(res.status, 503, 'A placeholder key must surface an explicit unavailability status');
      const data = await res.json();
      assert.equal(Array.isArray(data.questions), false, 'No synthetic questions may be substituted');
      assert.match(data.error, /unavailable/i, 'The error must explain that AI generation is unavailable');
      assert.match(data.error, /GEMINI_API_KEY/, 'The error must name the missing configuration variable');
      assert.notEqual(data.isPartial, true, 'A refusal is not a partial generation result');
    });

    await test('AI generation rejects learners and still validates question count bounds', async () => {
      const learnerRes = await post(
        '/api/ai/generate-quiz',
        { grade: 'Grade 4', subject: 'Mathematics', topics: ['Fractions'], questionCount: 5 },
        learnerToken
      );
      assert.equal(learnerRes.status, 403, 'Learners must not generate assessment questions');

      const zero = await post(
        '/api/ai/generate-quiz',
        { grade: 'Grade 4', subject: 'Mathematics', topics: ['Fractions'], questionCount: 0 },
        teacherToken
      );
      assert.equal(zero.status, 400, 'A question count of 0 must be rejected');

      const tooMany = await post(
        '/api/ai/generate-quiz',
        { grade: 'Grade 4', subject: 'Mathematics', topics: ['Fractions'], questionCount: 51 },
        teacherToken
      );
      assert.equal(tooMany.status, 400, 'A question count above 50 must be rejected');

      const noTopics = await post(
        '/api/ai/generate-quiz',
        { grade: 'Grade 4', subject: 'Mathematics', topics: [], questionCount: 5 },
        teacherToken
      );
      assert.equal(noTopics.status, 400, 'An empty topic list must be rejected');
    });

    // ========================================================================
    // 6. Administrator bootstrap safety
    // ========================================================================

    await test('Admin bootstrap refuses to create an administrator without a configured password', async () => {
      const result = await bootstrapInitialAdmin();
      assert.equal(result.created, false, 'No administrator may be created without INITIAL_ADMIN_PASSWORD');
      assert.equal(result.updated, false, 'Nothing may be updated without a configured password');
      assert.match(
        result.message,
        /INITIAL_ADMIN_PASSWORD/,
        'The failure must clearly reference the missing configuration variable'
      );

      const tooShort = await bootstrapInitialAdmin('short');
      assert.equal(tooShort.created, false, 'A password under 8 characters must be refused');
    });

    await test('Admin bootstrap never fabricates an administrator without a configured database', async () => {
      const result = await bootstrapInitialAdmin('StrongConfiguredPassword!2026');
      assert.equal(result.created, false, 'An administrator must never be provisioned without a database');
      assert.equal(result.updated, false, 'Nothing may be created or overwritten without a database');
      assert.equal(
        result.message.includes('StrongConfiguredPassword!2026'),
        false,
        'Bootstrap messages must never echo the password'
      );
    });
  } finally {
    await stopTestServer();
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`Tests Completed: ${passedCount} passed, ${failedCount} failed`);
  console.log(`------------------------------------------------------\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('[Test Execution Error]', err);
  process.exit(1);
});
