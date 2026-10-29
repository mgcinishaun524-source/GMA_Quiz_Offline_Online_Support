import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const agentsDir = 'c:\\Users\\thula\\Downloads\\growing-minds-academy-ai-quiz-system (1)\\.agents';
const scriptPath = path.join(agentsDir, 'provision-test-teacher.mjs');
const resultPath = path.join(agentsDir, 'provision-result.json');

const result = spawnSync(process.execPath, [scriptPath], {
  cwd: 'c:\\Users\\thula\\Downloads\\growing-minds-academy-ai-quiz-system (1)',
  encoding: 'utf8',
  timeout: 30000
});

const stdout = result.stdout || '';
const stderr = result.stderr || '';

// Write stdout to result file
if (stdout.trim()) {
  fs.writeFileSync(resultPath, stdout.trim(), 'utf8');
}

// Print diagnostics to our own stdout
process.stdout.write('STDOUT:' + stdout + '\n');
process.stdout.write('STDERR:' + stderr + '\n');
process.stdout.write('EXIT:' + result.status + '\n');
