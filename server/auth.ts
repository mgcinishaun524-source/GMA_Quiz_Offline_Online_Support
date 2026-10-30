import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin, getSupabaseAuth, isSupabaseConfigured } from './db.js';

// Session-signing secret resolution.
//
// The secret is read from the server-only SUPABASE_JWT_SECRET environment
// variable. No secret value is ever committed to source control.
//
// - If configured: it is used verbatim.
// - In production without a configured secret: signing/verification fails closed
//   (throws) rather than silently using a shared, predictable default.
// - In non-production (demo/dev/test) without a configured secret: an ephemeral,
//   per-process random secret is generated so local runs still work. Tokens are
//   invalidated when the process restarts, which is intentional.
let ephemeralJwtSecret: string | null = null;

export function getJwtSecret(): string {
  const configured = process.env.SUPABASE_JWT_SECRET;
  if (configured && configured.trim() !== '') {
    return configured.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SUPABASE_JWT_SECRET is not configured. Refusing to sign or verify session tokens in production without a server-only secret.'
    );
  }

  if (!ephemeralJwtSecret) {
    ephemeralJwtSecret = crypto.randomBytes(48).toString('hex');
    console.warn(
      '[auth] SUPABASE_JWT_SECRET is not set. Using an ephemeral in-memory session secret for this non-production process; tokens will be invalidated on restart.'
    );
  }
  return ephemeralJwtSecret;
}

// In-Memory Lockout Tracker for Learner PIN & Staff Password Brute-Force Defense
interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number | null;
}
const lockoutStore = new Map<string, LockoutRecord>();

export interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'teacher' | 'learner';
  email?: string;
  studentNumber?: string;
  name?: string;
  schoolId?: string;
  classId?: string;
  grade?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ----------------------------------------------------------------------------
// PIN & Password Utilities
// ----------------------------------------------------------------------------
export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(pin, salt);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Idempotently provision the initial administrator from INITIAL_ADMIN_PASSWORD.
 * Never creates duplicate accounts on repeated startups and never overwrites existing password.
 */
export async function bootstrapInitialAdmin(adminPassword?: string): Promise<{
  created: boolean;
  updated: boolean;
  message: string;
}> {
  const password = adminPassword || process.env.INITIAL_ADMIN_PASSWORD;
  const username = 'darksyntax';
  const email = process.env.INITIAL_ADMIN_EMAIL || 'darksyntax@gma.edu';
  const schoolId = '00000000-0000-0000-0000-000000000001';

  if (!password || password.trim().length < 8) {
    return {
      created: false,
      updated: false,
      message: 'INITIAL_ADMIN_PASSWORD is not configured or is under 8 characters. Administrator not provisioned.',
    };
  }

  const supabase = getSupabaseAdmin();
  const supabaseAuth = getSupabaseAuth();
  if (supabase && supabaseAuth) {
    try {
      // Check if admin already exists
      const { data: existingProfiles } = await supabase
        .from('user_profiles')
        .select('*')
        .or(`email.eq.${email},role.eq.admin`)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        const admin = existingProfiles[0] as {
          id: string;
          email?: string;
          username?: string | null;
        };
        const notes: string[] = [];

        // Backfill the staff-login username when the additive column exists and is
        // currently empty. This never touches the account password and is idempotent.
        if (!admin.username) {
          const { error: backfillErr } = await supabase
            .from('user_profiles')
            .update({ username })
            .eq('id', admin.id);
          notes.push(
            backfillErr
              ? 'username column unavailable (apply migration 20261026000001 to enable username login).'
              : 'staff username provisioned.'
          );
        } else if (admin.username !== username) {
          notes.push(`staff username is "${admin.username}".`);
        }

        // Opt-in only: realign the Supabase Auth password with INITIAL_ADMIN_PASSWORD.
        // Guarded by ADMIN_PASSWORD_RESET so stored credentials can never be overwritten silently.
        if (process.env.ADMIN_PASSWORD_RESET === 'true') {
          const { error: pwErr } = await supabaseAuth.auth.admin.updateUserById(admin.id, { password });
          notes.push(
            pwErr
              ? `password realignment failed: ${pwErr.message}`
              : 'password realigned with INITIAL_ADMIN_PASSWORD.'
          );
        }

        return {
          created: false,
          updated: notes.length > 0,
          message: `Administrator account already exists in Supabase. ${notes.join(' ')}`.trim(),
        };
      }

      // Also detect an existing admin by username (additive column; tolerate its absence
      // if the username migration has not yet been applied to this database).
      try {
        const { data: byUsername } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', username)
          .limit(1);
        if (byUsername && byUsername.length > 0) {
          return {
            created: false,
            updated: false,
            message: 'Administrator darksyntax already exists in Supabase. Existing credentials preserved.',
          };
        }
      } catch {
        // username column not present yet; email/role check above is authoritative.
      }

      const { data: authUser, error: authErr } = await supabaseAuth.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Administrator darksyntax', role: 'admin' },
      });

      if (authErr || !authUser.user) {
        return {
          created: false,
          updated: false,
          message: `Supabase admin creation failed: ${authErr?.message}`,
        };
      }

      const baseProfile = {
        id: authUser.user.id,
        school_id: schoolId,
        email,
        full_name: 'Administrator darksyntax',
        role: 'admin',
        avatar_initials: 'DS',
      };

      // Persist the requested login username when the column exists; fall back to the
      // email-only profile if the additive migration has not been applied yet.
      const withUsername = await supabase
        .from('user_profiles')
        .insert({ ...baseProfile, username });

      if (withUsername.error) {
        const withoutUsername = await supabase.from('user_profiles').insert(baseProfile);
        if (withoutUsername.error) {
          return {
            created: false,
            updated: false,
            message: `Administrator auth user created but profile insert failed: ${withoutUsername.error.message}`,
          };
        }
      }

      return {
        created: true,
        updated: false,
        message: 'Initial administrator darksyntax created successfully in Supabase.',
      };
    } catch (err: unknown) {
      return {
        created: false,
        updated: false,
        message: `Error during Supabase admin bootstrap: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Fail closed: without a configured database there is no local store to provision into.
  return {
    created: false,
    updated: false,
    message: 'Administrator bootstrap skipped: a configured Supabase connection is required.',
  };
}

export function checkLockout(studentNumber: string): { isLocked: boolean; remainingMinutes?: number } {
  const record = lockoutStore.get(studentNumber);
  if (!record || !record.lockedUntil) {
    return { isLocked: false };
  }

  const now = Date.now();
  if (now < record.lockedUntil) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { isLocked: true, remainingMinutes };
  }

  // Lockout expired; reset
  lockoutStore.delete(studentNumber);
  return { isLocked: false };
}

export function recordFailedAttempt(studentNumber: string): { attempts: number; isLocked: boolean } {
  const record = lockoutStore.get(studentNumber) || { failedAttempts: 0, lockedUntil: null };
  record.failedAttempts += 1;

  if (record.failedAttempts >= 5) {
    record.lockedUntil = Date.now() + 15 * 60 * 1000; // 15-minute lockout
    lockoutStore.set(studentNumber, record);
    return { attempts: record.failedAttempts, isLocked: true };
  }

  lockoutStore.set(studentNumber, record);
  return { attempts: record.failedAttempts, isLocked: false };
}

export function clearLockout(studentNumber: string): void {
  lockoutStore.delete(studentNumber);
}

export function resetLockoutsForTesting(): void {
  lockoutStore.clear();
  ipRateMap.clear();
}

// ----------------------------------------------------------------------------
// Token Utilities
// ----------------------------------------------------------------------------
export function generateStaffToken(payload: {
  id: string;
  email?: string;
  name?: string;
  role: 'admin' | 'teacher';
  schoolId?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
}): string {
  return jwt.sign(
    {
      sub: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      schoolId: payload.schoolId || '00000000-0000-0000-0000-000000000001',
      assignedClasses: payload.assignedClasses,
      assignedSubjects: payload.assignedSubjects,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyStaffToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (decoded && (decoded.role === 'admin' || decoded.role === 'teacher')) {
      return {
        id: decoded.sub,
        role: decoded.role,
        email: decoded.email,
        name: decoded.name,
        schoolId: decoded.schoolId,
        assignedClasses: decoded.assignedClasses,
        assignedSubjects: decoded.assignedSubjects,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function generateLearnerToken(payload: {
  id: string;
  studentNumber: string;
  name: string;
  grade: string;
  className: string;
  classId?: string;
  schoolId?: string;
}): string {
  return jwt.sign(
    {
      sub: payload.id,
      role: 'learner',
      studentNumber: payload.studentNumber,
      name: payload.name,
      grade: payload.grade,
      className: payload.className,
      classId: payload.classId || 'unassigned',
      schoolId: payload.schoolId || '00000000-0000-0000-0000-000000000001',
    },
    getJwtSecret(),
    { expiresIn: '12h' } // Single school day expiry
  );
}

export function verifyLearnerToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (decoded && decoded.role === 'learner') {
      return {
        id: decoded.sub,
        role: 'learner',
        studentNumber: decoded.studentNumber,
        name: decoded.name,
        schoolId: decoded.schoolId,
        classId: decoded.classId || 'cls-3a',
        grade: decoded.grade || 'Grade 3',
      };
    }
  } catch {
    return null;
  }
  return null;
}

// IP-based Rate Limiter for Authentication Attempts
const ipRateMap = new Map<string, { count: number; resetTime: number }>();

export function checkIpRateLimit(ip: string, maxRequests = 10, windowMs = 60000): { isAllowed: boolean; remaining: number } {
  const now = Date.now();
  const record = ipRateMap.get(ip);

  if (!record || now > record.resetTime) {
    ipRateMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { isAllowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { isAllowed: false, remaining: 0 };
  }

  record.count += 1;
  return { isAllowed: true, remaining: maxRequests - record.count };
}

// ----------------------------------------------------------------------------
// Authentication & Authorization Middlewares
// ----------------------------------------------------------------------------
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    return;
  }

  const token = authHeader.substring(7);

  // 1. Check if token is a signed learner token
  const learner = verifyLearnerToken(token);
  if (learner) {
    req.user = learner;
    next();
    return;
  }

  // 2. If Supabase is configured, verify standard Supabase Auth session token
  const supabase = getSupabaseAdmin();
  const supabaseAuth = getSupabaseAuth();
  if (supabase && supabaseAuth) {
    try {
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
      if (!error && user) {
        // Fetch user profile role from user_profiles table
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, full_name, school_id')
          .eq('id', user.id)
          .single();

        // Fail closed. A Supabase Auth account with no school profile is not a
        // recognized staff member: never default it to a privileged role or tenant.
        if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher') || !profile.school_id) {
          res.status(401).json({ error: 'Account has no recognized staff profile in this school.' });
          return;
        }

        req.user = {
          id: user.id,
          role: profile.role,
          email: user.email,
          name: profile.full_name,
          schoolId: profile.school_id,
        };
        next();
        return;
      }
    } catch {
      // Fall through to staff token check
    }
  }

  // 3. Check for signed staff token (used in fallback / test modes)
  const staff = verifyStaffToken(token);
  if (staff) {
    req.user = staff;
    next();
    return;
  }

  // In unconfigured environment, reject untrusted bearer tokens
  res.status(401).json({ error: 'Unrecognized or expired authentication token.' });
}

export function requireRole(allowedRoles: ('admin' | 'teacher' | 'learner')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: `Forbidden: requires one of [${allowedRoles.join(', ')}] role.` });
      return;
    }

    next();
  };
}
