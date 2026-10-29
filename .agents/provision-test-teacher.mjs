import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';

// Admin login
const adminRes = await fetch('http://localhost:3000/api/auth/staff-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'darksyntax',
    password: process.env.INITIAL_ADMIN_PASSWORD
  })
});
if (!adminRes.ok) throw new Error(`Admin login failed: ${adminRes.status}`);
const adminData = await adminRes.json();
const adminJwt = adminData.token;

// Generate random 16-char password, store in memory only
const teacherPass = crypto.randomBytes(8).toString('hex');

// Create teacher
const createRes = await fetch('http://localhost:3000/api/teachers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminJwt}`
  },
  body: JSON.stringify({
    name: 'Test Teacher (DELETE ME)',
    email: 'testteacher_deleteme@gma.edu',
    password: teacherPass,
    role: 'Subject Teacher',
    assignedClasses: [],
    assignedSubjects: []
  })
});
const createBody = await createRes.json();

if (createRes.status !== 201) {
  console.log(JSON.stringify({ http_status: createRes.status, error: createBody.error || createBody.message || 'unknown', teacher_id_saved: false }));
  process.exit(1);
}

const teacherId = createBody.id || createBody.teacher?.id || createBody.data?.id;
if (!teacherId) {
  console.log(JSON.stringify({ http_status: createRes.status, error: 'No id in response', teacher_id_saved: false }));
  process.exit(1);
}

// Save UUID to file (UUID is not a secret)
fs.writeFileSync('c:\\Users\\thula\\Downloads\\growing-minds-academy-ai-quiz-system (1)\\.agents\\test-teacher-id.txt', teacherId, 'utf8');

// Save password to tmp file (will be deleted by next phase immediately)
fs.writeFileSync('c:\\Users\\thula\\Downloads\\growing-minds-academy-ai-quiz-system (1)\\.agents\\test-teacher-pass.tmp', teacherPass, 'utf8');

console.log(JSON.stringify({
  http_status: createRes.status,
  teacher_id_saved: true,
  role: createBody.role || createBody.teacher?.role,
  name: createBody.name || createBody.teacher?.name,
  is_active: createBody.is_active ?? createBody.teacher?.is_active ?? true
}));
