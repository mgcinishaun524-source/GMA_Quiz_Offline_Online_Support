import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const agentsDir = 'c:\\Users\\thula\\Downloads\\growing-minds-academy-ai-quiz-system (1)\\.agents';
const cwd = 'c:\\Users\\thula\\Downloads\\growing-minds-academy-ai-quiz-system (1)';
const resultPath = path.join(agentsDir, 'provision-result.json');

// Step 1: Delete existing teacher
const del = spawnSync(process.execPath, [path.join(agentsDir, 'delete-existing-teacher.mjs')], {
  cwd,
  encoding: 'utf8',
  timeout: 30000
});
process.stdout.write('DELETE_STDOUT:' + (del.stdout || '') + '\n');
process.stdout.write('DELETE_STDERR:' + (del.stderr || '') + '\n');
process.stdout.write('DELETE_EXIT:' + del.status + '\n');

if (del.status !== 0) {
  process.stdout.write('Delete failed, aborting\n');
  process.exit(1);
}

// Wait a moment for Supabase to propagate
await new Promise(r => setTimeout(r, 2000));

// Step 2: Run provision script
const prov = spawnSync(process.execPath, [path.join(agentsDir, 'provision-test-teacher.mjs')], {
  cwd,
  encoding: 'utf8',
  timeout: 30000
});
process.stdout.write('PROV_STDOUT:' + (prov.stdout || '') + '\n');
process.stdout.write('PROV_STDERR:' + (prov.stderr || '') + '\n');
process.stdout.write('PROV_EXIT:' + prov.status + '\n');

// Save result
const stdout = (prov.stdout || '').trim();
if (stdout) {
  // Extract just the JSON line (last line with { in it)
  const lines = stdout.split('\n');
  const jsonLine = lines.filter(l => l.trim().startsWith('{')).pop() || stdout;
  fs.writeFileSync(resultPath, jsonLine.trim(), 'utf8');
  process.stdout.write('RESULT_SAVED:' + jsonLine.trim() + '\n');
}
