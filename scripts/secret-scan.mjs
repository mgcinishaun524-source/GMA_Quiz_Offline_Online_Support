#!/usr/bin/env node
/**
 * Git history secret scan for the Growing Minds Academy AI Quiz System.
 *
 * Walks every blob reachable from any ref (and the reflog), not just the
 * working tree, so secrets that were committed and later removed are still
 * caught. Written because `gitleaks` is not installed on the build machine.
 *
 * Secret values are never printed — matches are redacted to a short prefix and
 * a length so the report can be shared without leaking the credential.
 *
 * Usage:
 *   node scripts/secret-scan.mjs
 *   node scripts/secret-scan.mjs --verbose   # also list clean-but-suspicious files
 *
 * Exit code: 0 when clean, 1 when findings exist (suitable for CI).
 */

import { execFileSync } from 'node:child_process';

const VERBOSE = process.argv.includes('--verbose');

/** Files whose contents are not meaningful to scan. */
const SKIP_PATH_PATTERNS = [
  /^package-lock\.json$/,
  /^bun\.lock$/,
  /^pnpm-lock\.yaml$/,
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|pdf|zip|gz|mp4)$/i,
];

/**
 * Value fragments that mean "this is a placeholder, not a real credential".
 * Anything matching these is reported separately and never counted as a leak.
 */
const PLACEHOLDER_PATTERNS = [
  /^\s*$/,
  /^(true|false|null|undefined|none|n\/a)$/i,
  /your[-_ ]|placeholder|change[-_ ]?me|replace[-_ ]?me|example|dummy|sample/i,
  /^<.*>$/,
  /^\.{2,}$/,
  /^x{3,}$/i,
  /_here$/i,
  /^\$\{?[A-Z_]+\}?$/, // ${VAR} indirection, not a literal
  /^process\.env/,
  /^import\.meta\.env/,
];

const SECRET_PATTERNS = [
  {
    name: 'Google API key',
    severity: 'critical',
    regex: /AIza[0-9A-Za-z\-_]{35}/g,
  },
  {
    name: 'Groq API key',
    severity: 'critical',
    regex: /gsk_[A-Za-z0-9]{40,}/g,
  },
  {
    name: 'GitHub token',
    severity: 'critical',
    regex: /gh[pousr]_[A-Za-z0-9]{36,}/g,
  },
  {
    name: 'Private key block',
    severity: 'critical',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    name: 'AWS access key id',
    severity: 'critical',
    regex: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: 'Slack token',
    severity: 'critical',
    regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  },
  {
    name: 'JWT (Supabase key / session token)',
    severity: 'high',
    regex: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  },
  {
    name: 'Hardcoded secret assignment',
    severity: 'high',
    regex:
      /\b(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_JWT_SECRET|GEMINI_API_KEY|GROQ_API_KEY|INITIAL_ADMIN_PASSWORD|ADMIN_PASSWORD_RESET|DATABASE_URL|POSTGRES_PASSWORD|SECRET_KEY|API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|CLIENT_SECRET)\b\s*[:=]\s*["'`]?([^\s"'`,;)]{8,})/g,
    captureGroup: 1,
  },
  {
    name: 'Credential in a connection string',
    severity: 'high',
    regex: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s:@/]{6,}@/g,
  },
  {
    name: 'Generic bearer token assignment',
    severity: 'medium',
    regex: /\b(?:password|passwd|secret|token|apikey|api_key)\b\s*[:=]\s*["'`]([A-Za-z0-9_\-./+=]{16,})["'`]/gi,
    captureGroup: 1,
  },
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Every blob sha reachable from any ref, plus anything left in the reflog. */
function collectBlobs() {
  const args = ['rev-list', '--objects', '--all'];
  try {
    git([...args, '--reflog']);
  } catch {
    // --reflog unsupported in this Git version; --all alone is still complete
    // for reachable history.
  }

  let output = '';
  try {
    output = git([...args, '--reflog']);
  } catch {
    output = git(args);
  }

  const blobs = new Map(); // sha -> Set of paths
  for (const line of output.split('\n')) {
    if (!line) continue;
    const spaceAt = line.indexOf(' ');
    if (spaceAt === -1) continue;
    const sha = line.slice(0, spaceAt);
    const path = line.slice(spaceAt + 1);
    if (!path) continue; // tree/commit object, not a blob with a path
    if (SKIP_PATH_PATTERNS.some((re) => re.test(path))) continue;
    if (!blobs.has(sha)) blobs.set(sha, new Set());
    blobs.get(sha).add(path);
  }
  return blobs;
}

/** Read many blobs in one `git cat-file --batch` call. */
function readBlobs(shas) {
  if (shas.length === 0) return new Map();
  const raw = execFileSync('git', ['cat-file', '--batch'], {
    input: shas.join('\n'),
    maxBuffer: 1024 * 1024 * 1024,
  });

  const contents = new Map();
  let cursor = 0;
  while (cursor < raw.length) {
    const newlineAt = raw.indexOf(0x0a, cursor);
    if (newlineAt === -1) break;
    const header = raw.subarray(cursor, newlineAt).toString('utf8');
    const [sha, type, sizeText] = header.split(' ');
    const size = Number(sizeText);
    if (type !== 'blob' || !Number.isFinite(size)) break;

    const start = newlineAt + 1;
    const end = start + size;
    const body = raw.subarray(start, end);
    // Skip binaries: a NUL byte in the first 8 KB is a reliable tell.
    if (!body.subarray(0, 8192).includes(0x00)) {
      contents.set(sha, body.toString('utf8'));
    }
    cursor = end + 1; // skip the trailing newline
  }
  return contents;
}

function redact(value) {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return `**** (${trimmed.length} chars)`;
  return `${trimmed.slice(0, 4)}**** (${trimmed.length} chars)`;
}

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value.trim()));
}

function main() {
  console.log('Growing Minds Academy — Git history secret scan');
  console.log('  scope : every blob reachable from any ref + reflog');

  const blobs = collectBlobs();
  console.log(`  blobs : ${blobs.size} distinct file revisions`);
  console.log('  engine: built-in pattern scanner (gitleaks is not installed)\n');

  const contents = readBlobs([...blobs.keys()]);

  const findings = [];
  const skipped = [];

  for (const [sha, text] of contents) {
    const paths = [...blobs.get(sha)];
    const lines = text.split('\n');

    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 4000) continue; // skip minified bundles
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(line)) !== null) {
          const value = pattern.captureGroup ? match[pattern.captureGroup] : match[0];
          if (isPlaceholder(value)) {
            skipped.push({ paths, line: i + 1, pattern: pattern.name, value });
            continue;
          }
          findings.push({
            pattern: pattern.name,
            severity: pattern.severity,
            paths,
            line: i + 1,
            value,
          });
        }
      }
    }
  }

  if (VERBOSE && skipped.length > 0) {
    console.log(`Placeholders correctly ignored (${skipped.length}):`);
    for (const item of skipped.slice(0, 40)) {
      console.log(`  · ${item.paths.join(', ')}:${item.line} — ${item.pattern} = ${redact(item.value)}`);
    }
    console.log('');
  }

  if (findings.length === 0) {
    console.log('✓ CLEAN — no unredacted secrets found in the scanned history.');
    console.log(`  ${skipped.length} placeholder/indirection occurrences were correctly ignored.`);
    return 0;
  }

  console.log(`✗ ${findings.length} FINDING(S)\n`);
  for (const finding of findings) {
    console.log(`  [${finding.severity.toUpperCase()}] ${finding.pattern}`);
    console.log(`    file   : ${finding.paths.join(', ')}:${finding.line}`);
    console.log(`    blob   : ${[...blobs.entries()].find(([, paths]) => paths.has(finding.paths[0]))?.[0] ?? 'unknown'}`);
    console.log(`    match  : ${redact(finding.value)}`);
    console.log('');
  }
  return 1;
}

process.exit(main());
