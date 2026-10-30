// Growing Minds Academy — AI Configuration Honesty & Confidential Export Suite
//
// Covers the two areas where a fabricated result would be most damaging:
//
//   1. AI question generation. The server must be able to tell the difference between
//      a genuinely configured Gemini key and a placeholder, must report that status
//      truthfully through /api/health, and must refuse the request outright rather
//      than substituting synthetic questions presented as AI output.
//   2. Confidential assessment exports. Mark schemes and question papers must be
//      protected by authentication and role checks, and must never be fabricated
//      when the database backing them is unavailable.

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.SUPABASE_JWT_SECRET = 'generation-suite-ephemeral-secret-not-a-real-credential';

import { Server } from 'http';
import assert from 'node:assert/strict';

const { app } = await import('../server.js');
const { generateLearnerToken, generateStaffToken } = await import('../server/auth.js');

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

async function health() {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  return res.json();
}

async function runSuite() {
  console.log('======================================================');
  console.log(' Growing Minds Academy — AI Honesty & Export Tests');
  console.log('======================================================');

  await startTestServer();

  const teacherToken = generateStaffToken({
    id: 'tch-gen-1',
    email: 'teacher.gen@gma.edu',
    name: 'Generation Teacher',
    role: 'teacher',
  });

  const learnerToken = generateLearnerToken({
    id: 'lrn-gen-1',
    studentNumber: 'GMA-2026-8888',
    name: 'Generation Learner',
    grade: 'Grade 4',
    className: 'Grade 4A',
    classId: 'cls-4a',
  });

  // TEST 1: Every placeholder form is reported as unavailable
  await test('Placeholder Gemini keys are reported as unavailable rather than configured', async () => {
    const placeholders = ['', '   ', 'MY_GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY', 'YOUR_ANY_KEY'];

    for (const placeholder of placeholders) {
      process.env.GEMINI_API_KEY = placeholder;
      const data = await health();
      assert.equal(
        data.geminiConfigured,
        false,
        `GEMINI_API_KEY="${placeholder}" must not be reported as a working configuration`
      );
    }

    process.env.GEMINI_API_KEY = '';
  });

  // TEST 2: A plausible key IS reported as configured (status reflects real configuration)
  await test('A genuinely configured key is reported as configured by the health endpoint', async () => {
    process.env.GEMINI_API_KEY = 'AIzaSyPlaceholderProbeKeyForConfigurationReporting';
    try {
      const data = await health();
      assert.equal(
        data.geminiConfigured,
        true,
        'A non-placeholder key must be reported as configured so the status is truthful in both directions'
      );
      const raw = JSON.stringify(data);
      assert.equal(raw.includes('AIzaSy'), false, 'The health payload must never echo the key value');
    } finally {
      process.env.GEMINI_API_KEY = '';
    }
  });

  // TEST 3: Generation refuses rather than fabricating questions
  await test('Quiz generation is refused with an explicit error and no substituted questions', async () => {
    const res = await fetch(`${baseUrl}/api/ai/generate-quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        grade: 'Grade 4',
        subject: 'Mathematics',
        topics: ['Fractions', 'Decimals'],
        difficulty: 'medium',
        questionCount: 15,
      }),
    });

    assert.equal(res.status, 503, 'Unavailable AI generation must not return a success status');
    const data = await res.json();
    assert.equal(Array.isArray(data.questions), false, 'No synthetic questions may be substituted');
    assert.equal(data.isPartial, undefined, 'A refusal must not be dressed up as a partial generation');
    assert.equal(data.actualCount, undefined, 'A refusal must not report a generated count');
    assert.match(data.error, /unavailable/i, 'The error must explain that AI generation is unavailable');
  });

  // TEST 4: Confidential answer key requires authentication
  await test('The confidential answer key requires authentication', async () => {
    const res = await fetch(`${baseUrl}/api/quizzes/quiz-1/answer-key`);
    assert.equal(res.status, 401, 'An unauthenticated answer-key request must be rejected');

    const data = await res.json();
    assert.equal(data.answerKey, undefined, 'No answer key may be returned without authentication');
  });

  // TEST 5: Learners can never obtain the answer key
  await test('Learner tokens are forbidden from the confidential answer key endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/quizzes/quiz-1/answer-key`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    });
    assert.equal(res.status, 403, 'Learners must be forbidden from mark schemes');

    const data = await res.json();
    assert.equal(data.answerKey, undefined, 'No answer key may be returned to a learner');
  });

  // TEST 6: Question paper export is authenticated and never fabricated
  await test('Question paper export requires authentication and is not fabricated when storage is unavailable', async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/quizzes/quiz-1/paper`);
    assert.equal(unauthenticated.status, 401, 'An unauthenticated paper request must be rejected');

    const staff = await fetch(`${baseUrl}/api/quizzes/quiz-1/paper`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(staff.status, 503, 'With no database the paper must fail closed');
    const data = await staff.json();
    assert.equal(data.paper, undefined, 'No question paper may be fabricated');
  });

  await stopTestServer();

  console.log('------------------------------------------------------');
  console.log(`AI & Export Tests Completed: ${passedCount} passed, ${failedCount} failed`);
  console.log('------------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
