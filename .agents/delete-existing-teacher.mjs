import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const idFile = 'c:\\Users\\thula\\Downloads\\growing-minds-academy-ai-quiz-system (1)\\.agents\\test-teacher-id.txt';
const teacherId = fs.existsSync(idFile) ? fs.readFileSync(idFile, 'utf8').trim() : null;

if (!teacherId) {
  console.log(JSON.stringify({ deleted: false, error: 'No existing teacher ID file found' }));
  process.exit(0); // Not an error, just nothing to delete
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { error: delError } = await supabase.auth.admin.deleteUser(teacherId);
if (delError) {
  // If user doesn't exist, that's fine
  if (delError.message && (delError.message.includes('not found') || delError.message.includes('User not found'))) {
    console.log(JSON.stringify({ deleted: false, note: 'User not found in auth, already cleaned up' }));
    process.exit(0);
  }
  console.log(JSON.stringify({ deleted: false, error: delError.message }));
  process.exit(1);
}

console.log(JSON.stringify({ deleted: true, teacherId }));
