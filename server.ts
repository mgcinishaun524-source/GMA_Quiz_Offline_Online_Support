import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// ----------------------------------------------------------------------------
// Gemini (AI question generation) configuration probe
// ----------------------------------------------------------------------------
// A key only counts as configured when it is present and is NOT one of the
// documented placeholder values. This is the same rule the generation endpoint
// applies, so /api/health can never advertise AI generation as available while
// it would actually be refused. The key value itself is never logged or returned.
function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed === '') return false;
  if (trimmed === 'MY_GEMINI_API_KEY' || trimmed === 'YOUR_GEMINI_API_KEY') return false;
  if (trimmed.startsWith('YOUR_')) return false;
  return true;
}

// Parse JSON request bodies with safety limits
app.use(express.json({ limit: '1mb' }));

import {
  requireAuth,
  requireRole,
  hashPin,
  verifyPin,
  checkLockout,
  recordFailedAttempt,
  clearLockout,
  generateLearnerToken,
  generateStaffToken,
  verifyLearnerToken,
  verifyStaffToken,
  checkIpRateLimit,
  bootstrapInitialAdmin,
} from './server/auth.js';
import { getSupabaseAdmin, getSupabaseAuth, isSupabaseConfigured, logAuditEvent } from './server/db.js';
import { databaseAdapter, resolveUUID, SEED_ID_MAP } from './server/db/databaseAdapter.js';
import { Quiz } from './src/types/quiz.js';
import { Submission } from './src/types/submission.js';
import { ClassGroup, Learner, Subject, Teacher } from './src/types/learner.js';

// Health Check Endpoint (Safe: Never exposes secrets or connection strings)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Growing Minds Academy Assessment Backend',
    version: '1.0.0',
    geminiConfigured: isGeminiConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
    authMode: isSupabaseConfigured() ? 'supabase' : 'strict-production',
  });
});

// ----------------------------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ----------------------------------------------------------------------------

// 1. Staff Login (Admin / Teacher via Supabase Auth or resilient hardened store)
app.post('/api/auth/staff-login', async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rate = checkIpRateLimit(`staff-${ip}`, 20, 60000);
  if (!rate.isAllowed) {
    res.status(429).json({ error: 'Too many staff login requests. Please try again in 1 minute.' });
    return;
  }

  const { email, password } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Valid staff email address or username is required.' });
    return;
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required.' });
    return;
  }

  const cleanIdentifier = email.trim().toLowerCase();

  // Check account brute-force lockout status
  const lockout = checkLockout(cleanIdentifier);
  if (lockout.isLocked) {
    res.status(429).json({
      error: `Account is temporarily locked due to repeated failed attempts. Please try again in ${lockout.remainingMinutes} minute(s).`,
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  // Auth operations use a dedicated client so signing in never downgrades the
  // shared data client from the service role to the signed-in user's RLS role.
  const supabaseAuth = getSupabaseAuth();

  // Mode A: Live Supabase Auth
  if (supabase && supabaseAuth) {
    try {
      // Supabase Auth authenticates by email. Staff may sign in with a short username
      // (e.g. "darksyntax") that maps to a profile email via the additive
      // user_profiles.username column. Email logins continue to work unchanged.
      let authEmail = cleanIdentifier;
      if (!cleanIdentifier.includes('@')) {
        const { data: byUsername } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('username', cleanIdentifier)
          .maybeSingle();

        if (!byUsername?.email) {
          const failRecord = recordFailedAttempt(cleanIdentifier);
          res.status(401).json({
            error: failRecord.isLocked
              ? 'Account locked for 15 minutes due to 5 consecutive failed attempts.'
              : 'Invalid username or password.',
          });
          return;
        }
        authEmail = byUsername.email;
      }

      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: authEmail,
        password: String(password || ''),
      });

      if (error || !data.user || !data.session) {
        const failRecord = recordFailedAttempt(cleanIdentifier);
        await logAuditEvent({
          action: failRecord.isLocked ? 'AUTH_STAFF_LOCKED' : 'AUTH_STAFF_FAILED',
          actorId: cleanIdentifier,
          targetEntity: 'user_profiles',
          ipAddress: ip,
        });
        res.status(401).json({
          error: failRecord.isLocked
            ? 'Account locked for 15 minutes due to 5 consecutive failed attempts.'
            : 'Invalid email or password.',
        });
        return;
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      clearLockout(cleanIdentifier);

      await logAuditEvent({
        schoolId: profile?.school_id,
        action: 'AUTH_STAFF_LOGIN',
        actorId: data.user.id,
        actorRole: profile?.role || 'teacher',
        targetEntity: 'user_profiles',
        ipAddress: ip,
      });

      res.json({
        token: data.session.access_token,
        user: {
          id: data.user.id,
          name: profile?.full_name || 'Staff User',
          role: profile?.role || 'teacher',
          email: data.user.email,
          schoolId: profile?.school_id,
          avatarInitial: (profile?.full_name || 'ST').slice(0, 2).toUpperCase(),
        },
      });
      return;
    } catch (err: unknown) {
      console.error('[Supabase Staff Auth Error]', err);
      res.status(500).json({ error: 'Internal server error during staff verification.' });
      return;
    }
  }

  // Fail closed: with no configured database there are no demo staff accounts to fall back on.
  res.status(503).json({
    error: 'Authentication service unavailable. A configured Supabase connection is required to sign in.',
  });
});

// 2. Learner Login (Student Number + Salted 4-Digit PIN with Rate Limiting & Lockout)
app.post('/api/auth/learner-login', async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rate = checkIpRateLimit(`learner-${ip}`, 10, 60000);
  if (!rate.isAllowed) {
    res.status(429).json({ error: 'Too many authentication attempts. Please try again in 1 minute.' });
    return;
  }

  const { studentNumber, pin } = req.body;
  if (!studentNumber || typeof studentNumber !== 'string') {
    res.status(400).json({ error: 'Student Number is required (e.g. GMA-2026-0301).' });
    return;
  }

  const cleanNumber = studentNumber.trim().toUpperCase();
  const cleanPin = String(pin || '').trim();

  if (!/^\d{4}$/.test(cleanPin)) {
    res.status(400).json({ error: 'PIN must consist of exactly 4 numeric digits.' });
    return;
  }

  // Check brute-force lockout status
  const lockout = checkLockout(cleanNumber);
  if (lockout.isLocked) {
    res.status(429).json({
      error: `Account is temporarily locked due to repeated failed attempts. Please try again in ${lockout.remainingMinutes} minute(s) or contact your teacher.`,
    });
    return;
  }

  const supabase = getSupabaseAdmin();

  // Mode A: Live Supabase with salted bcrypt PIN verification
  if (supabase) {
    try {
      const { data: learner, error } = await supabase
        .from('learners')
        .select(`
          *,
          class_memberships(classes(id, name, grade_level))
        `)
        .eq('student_number', cleanNumber)
        .single();

      if (error || !learner || !learner.is_active) {
        const failRecord = recordFailedAttempt(cleanNumber);
        await logAuditEvent({
          action: failRecord.isLocked ? 'AUTH_PIN_LOCKED' : 'AUTH_PIN_FAILED',
          actorId: cleanNumber,
          targetEntity: 'learners',
          ipAddress: ip,
        });
        res.status(401).json({
          error: failRecord.isLocked
            ? 'Account locked for 15 minutes due to 5 consecutive failed attempts.'
            : 'Invalid Student Number or 4-digit PIN.',
        });
        return;
      }

      // Check DB-level lockout timestamp
      if (learner.pin_locked_until && new Date(learner.pin_locked_until) > new Date()) {
        res.status(429).json({
          error: 'Account locked due to consecutive failed attempts. Please ask your teacher to reset your PIN.',
        });
        return;
      }

      // Verify salted bcrypt PIN
      const isMatch = await verifyPin(cleanPin, learner.pin_hash);
      if (!isMatch) {
        const failRecord = recordFailedAttempt(cleanNumber);
        if (failRecord.isLocked) {
          const lockTime = new Date(Date.now() + 15 * 60000).toISOString();
          await supabase.from('learners').update({ pin_locked_until: lockTime }).eq('id', learner.id);
        }
        await logAuditEvent({
          action: failRecord.isLocked ? 'AUTH_PIN_LOCKED' : 'AUTH_PIN_FAILED',
          actorId: learner.id,
          targetEntity: 'learners',
          ipAddress: ip,
        });
        res.status(401).json({
          error: failRecord.isLocked
            ? 'Account locked for 15 minutes due to 5 consecutive failed attempts.'
            : 'Invalid Student Number or 4-digit PIN.',
        });
        return;
      }

      // Clear lockouts on valid verification
      clearLockout(cleanNumber);
      await supabase
        .from('learners')
        .update({ pin_failed_attempts: 0, pin_locked_until: null, last_active: new Date().toISOString() })
        .eq('id', learner.id);

      await logAuditEvent({
        schoolId: learner.school_id,
        action: 'AUTH_LEARNER_LOGIN',
        actorId: learner.id,
        actorRole: 'learner',
        targetEntity: 'learners',
        ipAddress: ip,
      });

      const memberships = (learner as any).class_memberships || [];
      const currentMembership = memberships.find((m: any) => m.academic_year === '2026-2027') || memberships[0];
      const assignedClass = currentMembership?.classes;
      const classId = assignedClass?.id || 'unassigned';
      const className = assignedClass?.name || 'Unassigned Cohort';
      const grade = assignedClass?.grade_level
        ? (assignedClass.grade_level.startsWith('Grade') ? assignedClass.grade_level : `Grade ${assignedClass.grade_level}`)
        : 'Unassigned';

      const token = generateLearnerToken({
        id: learner.id,
        studentNumber: learner.student_number,
        name: `${learner.first_name} ${learner.last_name}`,
        grade,
        className,
        classId,
        schoolId: learner.school_id,
      });

      res.json({
        token,
        user: {
          id: learner.id,
          name: `${learner.first_name} ${learner.last_name}`,
          role: 'learner',
          learnerId: learner.student_number,
          grade,
          className,
          avatarInitial: `${learner.first_name[0]}${learner.last_name[0]}`,
        },
      });
      return;
    } catch (err: unknown) {
      console.error('[Supabase Learner Auth Error]', err);
      res.status(500).json({ error: 'Server error during learner authentication.' });
      return;
    }
  }

  // Fail closed: with no configured database there are no demo learner accounts to fall back on.
  res.status(503).json({
    error: 'Authentication service unavailable. A configured Supabase connection is required to sign in.',
  });
});

// 3. Current Authenticated Profile Check
app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// 4. Create Staff Account (Admin Only - Strictly prohibited for unauthenticated or non-admin users)
app.post('/api/staff', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, role = 'teacher', assignedClasses = [], assignedSubjects = [], schoolId } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Valid staff email address is required.' });
    return;
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Full staff name is required.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }
  if (role !== 'teacher' && role !== 'admin') {
    res.status(400).json({ error: 'Role must be either "teacher" or "admin".' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const targetSchoolId = schoolId || req.user?.schoolId || '00000000-0000-0000-0000-000000000001';

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: name.trim(), role },
      });
      if (authErr || !authUser.user) {
        res.status(400).json({ error: authErr?.message || 'Failed to create staff account in Supabase.' });
        return;
      }
      const { data: profile, error: profErr } = await supabase.from('user_profiles').insert({
        id: authUser.user.id,
        school_id: targetSchoolId,
        email: cleanEmail,
        full_name: name.trim(),
        role,
        avatar_initials: name.trim().split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      }).select().single();

      if (profErr) {
        res.status(500).json({ error: `Failed to create profile: ${profErr.message}` });
        return;
      }

      await logAuditEvent({
        schoolId: targetSchoolId,
        action: 'STAFF_CREATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntity: 'user_profiles',
        targetId: profile.id,
        metadata: { email: cleanEmail, role },
      });

      res.status(201).json({
        user: {
          id: profile.id,
          name: profile.full_name,
          email: profile.email,
          role: profile.role,
          schoolId: profile.school_id,
        },
      });
      return;
    } catch (err: unknown) {
      res.status(500).json({ error: 'Internal server error while creating staff account.' });
      return;
    }
  }

  // Fail closed: staff accounts are only provisioned through the configured Supabase auth provider.
  res.status(503).json({ error: 'Staff provisioning requires a configured Supabase connection.' });
});

// ----------------------------------------------------------------------------
// LEARNER DIRECTORY ENDPOINTS
// Persists the student directory to Supabase (learners + class_memberships) with
// an explicit local fallback when Supabase is not configured. PINs are bcrypt
// hashed and their plaintext/hash form is never returned to any client.
// ----------------------------------------------------------------------------
const DEFAULT_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const CURRENT_ACADEMIC_YEAR = '2026-2027';

// The UI identifies classes by short codes ("cls-3a"); the database stores UUIDs.
const CLASS_UUID_TO_CODE: Record<string, string> = Object.entries(SEED_ID_MAP).reduce(
  (acc, [code, uuid]) => {
    if (code.startsWith('cls-')) acc[uuid] = code;
    return acc;
  },
  {} as Record<string, string>
);

interface LearnerRow {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  guardian_contact: string | null;
  enrolled_date: string | null;
  last_active: string | null;
  class_memberships?: { classes?: { id: string; name: string; grade_level: string } | null }[] | null;
}

const LEARNER_SELECT =
  'id, student_number, first_name, last_name, is_active, guardian_contact, enrolled_date, last_active, class_memberships(classes(id, name, grade_level))';

function mapLearnerRow(row: LearnerRow): Learner {
  const classInfo = (row.class_memberships || []).find((m) => m && m.classes)?.classes || null;
  const gradeLevel = classInfo?.grade_level || '';
  return {
    id: row.student_number,
    firstName: row.first_name,
    lastName: row.last_name,
    grade: gradeLevel ? (gradeLevel.startsWith('Grade') ? gradeLevel : `Grade ${gradeLevel}`) : 'Unassigned',
    classId: classInfo ? CLASS_UUID_TO_CODE[classInfo.id] || classInfo.id : 'unassigned',
    className: classInfo?.name || 'Unassigned Cohort',
    pin: '',
    isActive: row.is_active,
    enrolledDate: row.enrolled_date || new Date().toISOString(),
    lastActive: row.last_active || undefined,
    guardianContact: row.guardian_contact || undefined,
  };
}

async function generateStudentNumber(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>
): Promise<string> {
  const prefix = `GMA-${new Date().getFullYear()}-`;
  const { data } = await supabase
    .from('learners')
    .select('student_number')
    .like('student_number', `${prefix}%`)
    .order('student_number', { ascending: false })
    .limit(1);

  const last = data?.[0]?.student_number;
  const match = last ? String(last).match(/(\d+)\s*$/) : null;
  const nextSequence = match ? Number(match[1]) + 1 : 1;
  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

// 6a. List Learner Directory
app.get('/api/learners', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from('learners')
      .select(LEARNER_SELECT)
      .eq('school_id', schoolId)
      .order('student_number', { ascending: true });

    if (error) {
      res.status(500).json({ error: `Failed to load learners: ${error.message}` });
      return;
    }

    res.json({
      learners: ((data || []) as unknown as LearnerRow[]).map(mapLearnerRow),
      persisted: true,
    });
    return;
  }

  // Fail closed: the learner directory is served only from the configured database.
  res.status(503).json({ error: 'Learner directory is unavailable: a configured Supabase connection is required.' });
});

// 6b. Register Learner
app.post('/api/learners', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const { firstName, lastName, grade, classId, className, pin, guardianContact } = req.body || {};

  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
    res.status(400).json({ error: 'First name is required.' });
    return;
  }
  if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
    res.status(400).json({ error: 'Last name is required.' });
    return;
  }
  if (!/^\d{4}$/.test(String(pin || ''))) {
    res.status(400).json({ error: 'A 4-digit PIN is required for tablet sign-in.' });
    return;
  }

  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const cleanGuardian = guardianContact ? String(guardianContact).trim() : null;
  const supabase = getSupabaseAdmin();

  if (supabase) {
    try {
      const studentNumber = await generateStudentNumber(supabase);
      const learnerId = resolveUUID(studentNumber);
      const pinHash = await hashPin(String(pin));

      const { data: inserted, error: insertError } = await supabase
        .from('learners')
        .insert({
          id: learnerId,
          school_id: schoolId,
          student_number: studentNumber,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          pin_hash: pinHash,
          is_active: true,
          guardian_contact: cleanGuardian,
        })
        .select(LEARNER_SELECT)
        .single();

      if (insertError || !inserted) {
        res.status(500).json({ error: `Failed to create learner: ${insertError?.message || 'unknown error'}` });
        return;
      }

      const dbClassId = classId && classId !== 'all' ? resolveUUID(String(classId)) : null;
      if (dbClassId) {
        const { error: membershipError } = await supabase.from('class_memberships').insert({
          class_id: dbClassId,
          learner_id: learnerId,
          academic_year: CURRENT_ACADEMIC_YEAR,
        });
        if (membershipError) {
          console.error('[Learner Enrollment] class membership failed:', membershipError.message);
        }
      }

      await logAuditEvent({
        schoolId,
        action: 'LEARNER_CREATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntity: 'learners',
        targetId: learnerId,
        metadata: { studentNumber },
      });

      const { data: full } = await supabase.from('learners').select(LEARNER_SELECT).eq('id', learnerId).single();

      res.status(201).json({
        learner: mapLearnerRow((full || inserted) as unknown as LearnerRow),
        persisted: true,
      });
      return;
    } catch (err: unknown) {
      console.error('[Learner Enrollment Error]', err);
      res.status(500).json({ error: 'Internal server error while creating the learner.' });
      return;
    }
  }

  // Fail closed: learner enrolment writes exclusively to the configured database.
  res.status(503).json({ error: 'Learner enrolment requires a configured Supabase connection.' });
});

// 6c. Update Learner
app.put('/api/learners/:id', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const studentNumber = String(req.params.id || '').trim().toUpperCase();
  const { firstName, lastName, grade, classId, className, pin, guardianContact, isActive } = req.body || {};

  if (!studentNumber) {
    res.status(400).json({ error: 'Learner identifier is required.' });
    return;
  }
  if (pin !== undefined && pin !== null && String(pin) !== '' && !/^\d{4}$/.test(String(pin))) {
    res.status(400).json({ error: 'PIN must consist of exactly 4 numeric digits.' });
    return;
  }

  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data: existing, error: findError } = await supabase
      .from('learners')
      .select('id')
      .eq('student_number', studentNumber)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (findError) {
      res.status(500).json({ error: `Failed to update learner: ${findError.message}` });
      return;
    }
    if (!existing) {
      res.status(404).json({ error: `No learner found with student number ${studentNumber}.` });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (typeof firstName === 'string' && firstName.trim()) updates.first_name = firstName.trim();
    if (typeof lastName === 'string' && lastName.trim()) updates.last_name = lastName.trim();
    if (typeof guardianContact === 'string') updates.guardian_contact = guardianContact.trim() || null;
    if (typeof isActive === 'boolean') updates.is_active = isActive;
    if (pin !== undefined && String(pin) !== '') {
      updates.pin_hash = await hashPin(String(pin));
      updates.pin_failed_attempts = 0;
      updates.pin_locked_until = null;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from('learners').update(updates).eq('id', existing.id);
      if (updateError) {
        res.status(500).json({ error: `Failed to update learner: ${updateError.message}` });
        return;
      }
    }

    if (classId !== undefined) {
      const dbClassId = classId && classId !== 'all' ? resolveUUID(String(classId)) : null;
      const { error: clearError } = await supabase.from('class_memberships').delete().eq('learner_id', existing.id);
      if (clearError) {
        res.status(500).json({ error: `Failed to update class placement: ${clearError.message}` });
        return;
      }
      if (dbClassId) {
        await supabase.from('class_memberships').insert({
          class_id: dbClassId,
          learner_id: existing.id,
          academic_year: CURRENT_ACADEMIC_YEAR,
        });
      }
    }

    await logAuditEvent({
      schoolId,
      action: 'LEARNER_UPDATED',
      actorId: req.user!.id,
      actorRole: req.user!.role,
      targetEntity: 'learners',
      targetId: existing.id,
      metadata: { studentNumber },
    });

    const { data: full } = await supabase.from('learners').select(LEARNER_SELECT).eq('id', existing.id).single();
    if (!full) {
      res.status(404).json({ error: `No learner found with student number ${studentNumber}.` });
      return;
    }

    res.json({ learner: mapLearnerRow(full as unknown as LearnerRow), persisted: true });
    return;
  }

  // Fail closed: learner records are updated exclusively in the configured database.
  res.status(503).json({ error: 'Updating learners requires a configured Supabase connection.' });
});

// 6d. Delete Learner
app.delete('/api/learners/:id', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const studentNumber = String(req.params.id || '').trim().toUpperCase();
  if (!studentNumber) {
    res.status(400).json({ error: 'Learner identifier is required.' });
    return;
  }

  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data: existing, error: findError } = await supabase
      .from('learners')
      .select('id')
      .eq('student_number', studentNumber)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (findError) {
      res.status(500).json({ error: `Failed to delete learner: ${findError.message}` });
      return;
    }
    if (!existing) {
      res.status(404).json({ error: `No learner found with student number ${studentNumber}.` });
      return;
    }

    // Deleting a learner cascades to their submissions, so preserve assessment history.
    const { count: submissionCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('learner_id', existing.id);

    if (submissionCount && submissionCount > 0) {
      res.status(409).json({
        error: `Cannot delete ${studentNumber}: ${submissionCount} assessment submission(s) are linked to this record. Deactivate the account instead.`,
      });
      return;
    }

    const { error: deleteError } = await supabase.from('learners').delete().eq('id', existing.id);
    if (deleteError) {
      res.status(500).json({ error: `Failed to delete learner: ${deleteError.message}` });
      return;
    }

    await logAuditEvent({
      schoolId,
      action: 'LEARNER_DELETED',
      actorId: req.user!.id,
      actorRole: req.user!.role,
      targetEntity: 'learners',
      targetId: existing.id,
      metadata: { studentNumber },
    });

    res.json({ success: true, persisted: true });
    return;
  }

  // Fail closed: learner records are deleted exclusively from the configured database.
  res.status(503).json({ error: 'Deleting learners requires a configured Supabase connection.' });
});

// ----------------------------------------------------------------------------
// ACADEMIC DIRECTORY ENDPOINTS (Subjects, Classes/Grades, Faculty)
// Persists everything created in the admin console to Supabase so records appear
// in the database. Optional association columns (classes.subject_ids,
// teachers.assigned_class_ids / assigned_subject_ids) are written additively and
// tolerated when that migration has not yet been applied. Everything fails closed
// when Supabase is not configured.
// ----------------------------------------------------------------------------

// Reverse of SEED_ID_MAP so stored UUIDs surface as familiar short codes in the UI.
function buildReverseSeedMap(prefix: string): Record<string, string> {
  return Object.entries(SEED_ID_MAP).reduce((acc, [code, uuid]) => {
    if (code.startsWith(prefix)) acc[uuid] = code;
    return acc;
  }, {} as Record<string, string>);
}

const SUBJECT_UUID_TO_CODE = buildReverseSeedMap('subj-');

// Detects a Postgres "undefined table/column" error so the additive association
// migration can be applied independently without breaking the API.
function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message || '';
  return (
    error.code === '42P01' || // undefined_table
    error.code === '42703' || // undefined_column
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const TEACHER_ROLES: Teacher['role'][] = ['Subject Teacher', 'Lead Teacher', 'Head of Department'];

// Resolves a submitted class/subject/teacher identifier to an id that exists in the
// database for this school, so association arrays never hold dangling references.
async function resolveExistingIds(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: 'classes' | 'subjects',
  schoolId: string,
  ids: unknown
): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const candidates = ids.map((id) => resolveUUID(String(id)));
  const { data } = await supabase.from(table).select('id').eq('school_id', schoolId).in('id', candidates);
  return (data || []).map((row) => row.id as string);
}

async function resolveExistingTeacherId(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  candidate: unknown,
  schoolId: string
): Promise<string | null> {
  if (!candidate || typeof candidate !== 'string' || !candidate.trim()) return null;
  const resolved = resolveUUID(candidate.trim());
  const { data } = await supabase
    .from('teachers')
    .select('id')
    .eq('id', resolved)
    .eq('school_id', schoolId)
    .maybeSingle();
  return data ? (data.id as string) : null;
}

// ---- SUBJECTS ----

const SUBJECT_COLUMNS = 'id, name, code, description, grade_levels, topic_count';

interface SubjectRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  grade_levels: string[] | null;
  topic_count: number | null;
}

function mapSubjectRow(row: SubjectRow): Subject {
  return {
    id: SUBJECT_UUID_TO_CODE[row.id] || row.id,
    name: row.name,
    code: row.code,
    gradeLevels: Array.isArray(row.grade_levels) ? row.grade_levels : [],
    topicCount: typeof row.topic_count === 'number' ? row.topic_count : 10,
    description: row.description || undefined,
  };
}

app.get('/api/subjects', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Subject directory is unavailable: a configured Supabase connection is required.' });
    return;
  }

  const { data, error } = await supabase
    .from('subjects')
    .select(SUBJECT_COLUMNS)
    .eq('school_id', schoolId)
    .order('name', { ascending: true });

  if (error) {
    res.status(500).json({ error: `Failed to load subjects: ${error.message}` });
    return;
  }

  res.json({ subjects: ((data || []) as unknown as SubjectRow[]).map(mapSubjectRow), persisted: true });
});

app.post('/api/subjects', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const { name, code, topicCount, description, gradeLevels } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Subject name is required.' });
    return;
  }
  if (!code || typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ error: 'Subject code is required.' });
    return;
  }

  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const cleanCode = code.trim().toUpperCase();
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Subject creation requires a configured Supabase connection.' });
    return;
  }

  const { data: duplicate } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('code', cleanCode)
    .maybeSingle();
  if (duplicate) {
    res.status(409).json({ error: `Subject code "${cleanCode}" is already assigned to ${duplicate.name}.` });
    return;
  }

  const { data: inserted, error } = await supabase
    .from('subjects')
    .insert({
      school_id: schoolId,
      name: name.trim(),
      code: cleanCode,
      description: description ? String(description).trim() : null,
      grade_levels: Array.isArray(gradeLevels) ? gradeLevels : [],
      topic_count: Number.isFinite(Number(topicCount)) ? Number(topicCount) : 10,
    })
    .select(SUBJECT_COLUMNS)
    .single();

  if (error || !inserted) {
    if (error?.code === '23505') {
      res.status(409).json({ error: `Subject code "${cleanCode}" already exists.` });
      return;
    }
    res.status(500).json({ error: `Failed to create subject: ${error?.message || 'unknown error'}` });
    return;
  }

  await logAuditEvent({
    schoolId,
    action: 'SUBJECT_CREATED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'subjects',
    targetId: inserted.id,
    metadata: { code: cleanCode },
  });

  res.status(201).json({ subject: mapSubjectRow(inserted as unknown as SubjectRow), persisted: true });
});

app.put('/api/subjects/:id', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const rawId = String(req.params.id || '').trim();
  if (!rawId) {
    res.status(400).json({ error: 'Subject identifier is required.' });
    return;
  }

  const { name, code, topicCount, description, gradeLevels } = req.body || {};
  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Updating subjects requires a configured Supabase connection.' });
    return;
  }

  const subjectId = resolveUUID(rawId);
  const updates: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (typeof code === 'string' && code.trim()) updates.code = code.trim().toUpperCase();
  if (topicCount !== undefined && Number.isFinite(Number(topicCount))) updates.topic_count = Number(topicCount);
  if (typeof description === 'string') updates.description = description.trim() || null;
  if (Array.isArray(gradeLevels)) updates.grade_levels = gradeLevels;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No subject changes were provided.' });
    return;
  }

  const { data, error } = await supabase
    .from('subjects')
    .update(updates)
    .eq('id', subjectId)
    .eq('school_id', schoolId)
    .select(SUBJECT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'That subject code is already in use.' });
      return;
    }
    res.status(500).json({ error: `Failed to update subject: ${error.message}` });
    return;
  }
  if (!data) {
    res.status(404).json({ error: 'No matching subject was found.' });
    return;
  }

  await logAuditEvent({
    schoolId,
    action: 'SUBJECT_UPDATED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'subjects',
    targetId: subjectId,
    metadata: { code: data.code },
  });

  res.json({ subject: mapSubjectRow(data as unknown as SubjectRow), persisted: true });
});

// ---- CLASSES / GRADES ----

const CLASS_BASE_COLUMNS = 'id, name, grade_level, room, form_teacher_id';

interface ClassRow {
  id: string;
  name: string;
  grade_level: string;
  room: string | null;
  form_teacher_id: string | null;
  subject_ids?: string[] | null;
}

async function fetchTeacherNameMap(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  schoolId: string
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const { data } = await supabase
    .from('teachers')
    .select('id, user_profiles(full_name)')
    .eq('school_id', schoolId);
  (data || []).forEach((row: any) => {
    const fullName = row?.user_profiles?.full_name;
    if (row?.id && fullName) names.set(row.id as string, fullName as string);
  });
  return names;
}

function mapClassRow(
  row: ClassRow,
  teacherNames: Map<string, string>,
  learnerCounts: Map<string, number>
): ClassGroup {
  const teacherId = row.form_teacher_id || '';
  return {
    id: CLASS_UUID_TO_CODE[row.id] || row.id,
    name: row.name,
    grade: row.grade_level,
    classTeacherId: teacherId,
    classTeacherName: teacherId ? teacherNames.get(teacherId) || 'Unassigned' : 'Unassigned',
    subjectIds: Array.isArray(row.subject_ids)
      ? row.subject_ids.map((uuid) => SUBJECT_UUID_TO_CODE[uuid] || uuid)
      : [],
    learnerCount: learnerCounts.get(row.id) || 0,
    room: row.room || undefined,
  };
}

app.get('/api/classes', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Class directory is unavailable: a configured Supabase connection is required.' });
    return;
  }

  let classRows: any[] | null = null;
  let error: { code?: string; message?: string } | null = null;

  ({ data: classRows, error } = await supabase
    .from('classes')
    .select(`${CLASS_BASE_COLUMNS}, subject_ids`)
    .eq('school_id', schoolId)
    .order('name', { ascending: true }));

  // Tolerate the association column not being present yet.
  if (error && isMissingSchemaError(error)) {
    ({ data: classRows, error } = await supabase
      .from('classes')
      .select(CLASS_BASE_COLUMNS)
      .eq('school_id', schoolId)
      .order('name', { ascending: true }));
  }

  if (error) {
    res.status(500).json({ error: `Failed to load classes: ${error.message}` });
    return;
  }

  const rows = (classRows || []) as unknown as ClassRow[];
  const classIds = rows.map((row) => row.id);

  const teacherNames = await fetchTeacherNameMap(supabase, schoolId);

  const learnerCounts = new Map<string, number>();
  if (classIds.length > 0) {
    const { data: memberships } = await supabase
      .from('class_memberships')
      .select('class_id')
      .in('class_id', classIds);
    (memberships || []).forEach((m: any) => {
      if (m?.class_id) learnerCounts.set(m.class_id, (learnerCounts.get(m.class_id) || 0) + 1);
    });
  }

  res.json({ classes: rows.map((row) => mapClassRow(row, teacherNames, learnerCounts)), persisted: true });
});

app.post('/api/classes', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const { name, grade, classTeacherId, room, subjectIds } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Class name is required (e.g. Grade 3C).' });
    return;
  }
  if (!grade || typeof grade !== 'string' || !grade.trim()) {
    res.status(400).json({ error: 'Grade level is required.' });
    return;
  }

  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Class creation requires a configured Supabase connection.' });
    return;
  }

  const formTeacherId = await resolveExistingTeacherId(supabase, classTeacherId, schoolId);
  const subjectUuids = await resolveExistingIds(supabase, 'subjects', schoolId, subjectIds);

  const payload: Record<string, unknown> = {
    school_id: schoolId,
    name: name.trim(),
    grade_level: grade.trim(),
    room: room ? String(room).trim() : null,
    form_teacher_id: formTeacherId,
    subject_ids: subjectUuids,
  };

  let inserted: any = null;
  let error: { code?: string; message?: string } | null = null;

  ({ data: inserted, error } = await supabase
    .from('classes')
    .insert(payload)
    .select(`${CLASS_BASE_COLUMNS}, subject_ids`)
    .single());

  if (error && isMissingSchemaError(error)) {
    delete payload.subject_ids;
    ({ data: inserted, error } = await supabase
      .from('classes')
      .insert(payload)
      .select(CLASS_BASE_COLUMNS)
      .single());
    if (!error && inserted) inserted.subject_ids = subjectUuids;
  }

  if (error || !inserted) {
    if (error?.code === '23505') {
      res.status(409).json({ error: `A class named "${name.trim()}" already exists.` });
      return;
    }
    res.status(500).json({ error: `Failed to create class: ${error?.message || 'unknown error'}` });
    return;
  }

  await logAuditEvent({
    schoolId,
    action: 'CLASS_CREATED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'classes',
    targetId: inserted.id,
    metadata: { name: inserted.name, grade: inserted.grade_level },
  });

  const teacherNames = await fetchTeacherNameMap(supabase, schoolId);
  res.status(201).json({
    class: mapClassRow(inserted as unknown as ClassRow, teacherNames, new Map()),
    persisted: true,
  });
});

app.put('/api/classes/:id', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const rawId = String(req.params.id || '').trim();
  if (!rawId) {
    res.status(400).json({ error: 'Class identifier is required.' });
    return;
  }

  const { name, grade, classTeacherId, room, subjectIds } = req.body || {};
  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Updating classes requires a configured Supabase connection.' });
    return;
  }

  const classId = resolveUUID(rawId);
  const updates: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (typeof grade === 'string' && grade.trim()) updates.grade_level = grade.trim();
  if (typeof room === 'string') updates.room = room.trim() || null;
  if (classTeacherId !== undefined) {
    updates.form_teacher_id = await resolveExistingTeacherId(supabase, classTeacherId, schoolId);
  }
  if (subjectIds !== undefined) {
    updates.subject_ids = await resolveExistingIds(supabase, 'subjects', schoolId, subjectIds);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No class changes were provided.' });
    return;
  }

  let updated: any = null;
  let error: { code?: string; message?: string } | null = null;

  ({ data: updated, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', classId)
    .eq('school_id', schoolId)
    .select(`${CLASS_BASE_COLUMNS}, subject_ids`)
    .maybeSingle());

  if (error && isMissingSchemaError(error) && 'subject_ids' in updates) {
    delete updates.subject_ids;
    ({ data: updated, error } = await supabase
      .from('classes')
      .update(updates)
      .eq('id', classId)
      .eq('school_id', schoolId)
      .select(CLASS_BASE_COLUMNS)
      .maybeSingle());
  }

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: `A class named "${String(name || '').trim()}" already exists.` });
      return;
    }
    res.status(500).json({ error: `Failed to update class: ${error.message}` });
    return;
  }
  if (!updated) {
    res.status(404).json({ error: 'No matching class was found.' });
    return;
  }

  await logAuditEvent({
    schoolId,
    action: 'CLASS_UPDATED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'classes',
    targetId: classId,
    metadata: { name: updated.name },
  });

  const teacherNames = await fetchTeacherNameMap(supabase, schoolId);
  res.json({ class: mapClassRow(updated as unknown as ClassRow, teacherNames, new Map()), persisted: true });
});

// ---- FACULTY / TEACHERS ----

interface TeacherRow {
  id: string;
  title_role: string | null;
  is_active: boolean | null;
  joined_date: string | null;
  assigned_class_ids?: string[] | null;
  assigned_subject_ids?: string[] | null;
  user_profiles?: { full_name?: string | null; email?: string | null } | null;
}

function mapTeacherRow(row: TeacherRow): Teacher {
  const profile = row.user_profiles || {};
  const role = TEACHER_ROLES.includes(row.title_role as Teacher['role'])
    ? (row.title_role as Teacher['role'])
    : 'Subject Teacher';
  return {
    id: row.id,
    name: profile.full_name || 'Unnamed Faculty',
    email: profile.email || '',
    role,
    assignedClasses: Array.isArray(row.assigned_class_ids)
      ? row.assigned_class_ids.map((uuid) => CLASS_UUID_TO_CODE[uuid] || uuid)
      : [],
    assignedSubjects: Array.isArray(row.assigned_subject_ids)
      ? row.assigned_subject_ids.map((uuid) => SUBJECT_UUID_TO_CODE[uuid] || uuid)
      : [],
    isActive: row.is_active !== false,
    joinedDate: row.joined_date || new Date().toISOString(),
  };
}

const TEACHER_BASE_COLUMNS = 'id, title_role, is_active, joined_date';
const TEACHER_JOIN_COLUMNS = 'user_profiles(id, full_name, email)';

app.get('/api/teachers', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Faculty directory is unavailable: a configured Supabase connection is required.' });
    return;
  }

  let rows: any[] | null = null;
  let error: { code?: string; message?: string } | null = null;

  ({ data: rows, error } = await supabase
    .from('teachers')
    .select(`${TEACHER_BASE_COLUMNS}, assigned_class_ids, assigned_subject_ids, ${TEACHER_JOIN_COLUMNS}`)
    .eq('school_id', schoolId)
    .order('joined_date', { ascending: true }));

  if (error && isMissingSchemaError(error)) {
    ({ data: rows, error } = await supabase
      .from('teachers')
      .select(`${TEACHER_BASE_COLUMNS}, ${TEACHER_JOIN_COLUMNS}`)
      .eq('school_id', schoolId)
      .order('joined_date', { ascending: true }));
  }

  if (error) {
    res.status(500).json({ error: `Failed to load faculty: ${error.message}` });
    return;
  }

  res.json({ teachers: ((rows || []) as unknown as TeacherRow[]).map(mapTeacherRow), persisted: true });
});

app.post('/api/teachers', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const { name, email, role = 'Subject Teacher', assignedClasses = [], assignedSubjects = [], password } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Full staff name is required.' });
    return;
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'A valid staff email address is required.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'A password of at least 8 characters is required so the teacher can sign in.' });
    return;
  }

  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const cleanRole = TEACHER_ROLES.includes(role) ? role : 'Subject Teacher';

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Teacher provisioning requires a configured Supabase connection.' });
    return;
  }

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: cleanName, role: 'teacher' },
  });
  if (authErr || !authUser.user) {
    res.status(400).json({ error: authErr?.message || 'Failed to create the teacher login in Supabase Auth.' });
    return;
  }

  const teacherId = authUser.user.id;

  const { error: profileErr } = await supabase.from('user_profiles').upsert({
    id: teacherId,
    school_id: schoolId,
    email: cleanEmail,
    full_name: cleanName,
    role: 'teacher',
    avatar_initials: initialsFor(cleanName),
  });

  if (profileErr) {
    await supabase.auth.admin.deleteUser(teacherId);
    res.status(500).json({ error: `Failed to create the teacher profile: ${profileErr.message}` });
    return;
  }

  const classIds = await resolveExistingIds(supabase, 'classes', schoolId, assignedClasses);
  const subjectUuids = await resolveExistingIds(supabase, 'subjects', schoolId, assignedSubjects);

  const teacherPayload: Record<string, unknown> = {
    id: teacherId,
    school_id: schoolId,
    title_role: cleanRole,
    is_active: true,
    assigned_class_ids: classIds,
    assigned_subject_ids: subjectUuids,
  };

  let teacherErr: { code?: string; message?: string } | null = null;
  ({ error: teacherErr } = await supabase.from('teachers').upsert(teacherPayload));
 
  if (teacherErr && isMissingSchemaError(teacherErr)) {
    delete teacherPayload.assigned_class_ids;
    delete teacherPayload.assigned_subject_ids;
    ({ error: teacherErr } = await supabase.from('teachers').upsert(teacherPayload));
  }

  if (teacherErr) {
    await supabase.from('user_profiles').delete().eq('id', teacherId);
    await supabase.auth.admin.deleteUser(teacherId);
    res.status(500).json({ error: `Failed to create the faculty record: ${teacherErr.message}` });
    return;
  }

  await logAuditEvent({
    schoolId,
    action: 'STAFF_CREATED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'teachers',
    targetId: teacherId,
    metadata: { email: cleanEmail, role: cleanRole },
  });

  res.status(201).json({
    teacher: {
      id: teacherId,
      name: cleanName,
      email: cleanEmail,
      role: cleanRole,
      assignedClasses,
      assignedSubjects,
      isActive: true,
      joinedDate: new Date().toISOString(),
    } as Teacher,
    persisted: true,
  });
});

app.put('/api/teachers/:id', requireAuth, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  const rawId = String(req.params.id || '').trim();
  if (!rawId) {
    res.status(400).json({ error: 'Teacher identifier is required.' });
    return;
  }

  const { name, email, role, assignedClasses, assignedSubjects, isActive, password } = req.body || {};
  const schoolId = req.user?.schoolId || DEFAULT_SCHOOL_ID;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Updating teachers requires a configured Supabase connection.' });
    return;
  }

  const teacherId = resolveUUID(rawId);
  const { data: existing, error: findError } = await supabase
    .from('teachers')
    .select('id')
    .eq('id', teacherId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (findError) {
    res.status(500).json({ error: `Failed to update the teacher: ${findError.message}` });
    return;
  }
  if (!existing) {
    res.status(404).json({ error: 'No matching faculty member was found.' });
    return;
  }

  if (password !== undefined && password !== null && password !== '') {
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'A new password must be at least 8 characters long.' });
      return;
    }
    const { error: pwdErr } = await supabase.auth.admin.updateUserById(teacherId, { password });
    if (pwdErr) {
      res.status(500).json({ error: `Failed to update the teacher password: ${pwdErr.message}` });
      return;
    }
  }

  const profileUpdates: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) {
    profileUpdates.full_name = name.trim();
    profileUpdates.avatar_initials = initialsFor(name.trim());
  }
  if (typeof email === 'string' && email.trim() && email.includes('@')) {
    const cleanEmail = email.trim().toLowerCase();
    const { error: emailErr } = await supabase.auth.admin.updateUserById(teacherId, { email: cleanEmail, email_confirm: true });
    if (emailErr) {
      res.status(400).json({ error: `Failed to update the teacher email: ${emailErr.message}` });
      return;
    }
    profileUpdates.email = cleanEmail;
  }
  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileErr } = await supabase.from('user_profiles').update(profileUpdates).eq('id', teacherId);
    if (profileErr) {
      res.status(500).json({ error: `Failed to update the teacher profile: ${profileErr.message}` });
      return;
    }
  }

  const teacherUpdates: Record<string, unknown> = {};
  if (typeof role === 'string' && TEACHER_ROLES.includes(role as Teacher['role'])) teacherUpdates.title_role = role;
  if (typeof isActive === 'boolean') teacherUpdates.is_active = isActive;
  if (assignedClasses !== undefined) {
    teacherUpdates.assigned_class_ids = await resolveExistingIds(supabase, 'classes', schoolId, assignedClasses);
  }
  if (assignedSubjects !== undefined) {
    teacherUpdates.assigned_subject_ids = await resolveExistingIds(supabase, 'subjects', schoolId, assignedSubjects);
  }

  if (Object.keys(teacherUpdates).length > 0) {
    let { error: updateErr } = await supabase.from('teachers').update(teacherUpdates).eq('id', teacherId);

    if (updateErr && isMissingSchemaError(updateErr)) {
      delete teacherUpdates.assigned_class_ids;
      delete teacherUpdates.assigned_subject_ids;
      if (Object.keys(teacherUpdates).length > 0) {
        ({ error: updateErr } = await supabase.from('teachers').update(teacherUpdates).eq('id', teacherId));
      } else {
        updateErr = null;
      }
    }

    if (updateErr) {
      res.status(500).json({ error: `Failed to update the teacher: ${updateErr.message}` });
      return;
    }
  }

  await logAuditEvent({
    schoolId,
    action: 'STAFF_UPDATED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'teachers',
    targetId: teacherId,
    metadata: {},
  });

  const rowQuery = supabase
    .from('teachers')
    .select(`${TEACHER_BASE_COLUMNS}, assigned_class_ids, assigned_subject_ids, ${TEACHER_JOIN_COLUMNS}`)
    .eq('id', teacherId)
    .maybeSingle();

  let { data: updated, error: readErr } = await rowQuery;

  if (readErr && isMissingSchemaError(readErr)) {
    ({ data: updated, error: readErr } = await supabase
      .from('teachers')
      .select(`${TEACHER_BASE_COLUMNS}, ${TEACHER_JOIN_COLUMNS}`)
      .eq('id', teacherId)
      .maybeSingle());
  }

  if (readErr || !updated) {
    res.status(500).json({ error: `Teacher updated but could not be re-read: ${readErr?.message || 'not found'}` });
    return;
  }

  res.json({ teacher: mapTeacherRow(updated as unknown as TeacherRow), persisted: true });
});

// ----------------------------------------------------------------------------
// QUIZ & QUESTION ENDPOINTS
// ----------------------------------------------------------------------------

function isAuthorizedSchool(quizSchoolId?: string, userSchoolId?: string): boolean {
  // Fail closed: a missing school identifier on either side is never treated as a
  // match. Defaulting both sides to the same tenant would silently authorize every
  // caller whose session carries no school.
  if (!quizSchoolId || !userSchoolId) {
    return false;
  }
  return quizSchoolId === userSchoolId;
}

// 4. List Quizzes (Role-Scoped, Class-Eligible & Answer-Key Protected)
app.get('/api/quizzes', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const allQuizzes = await databaseAdapter.getQuizzes(req.user?.schoolId);

  // If requester is a learner:
  // 1. Filter only published, open, or results_released quizzes (never draft or archived)
  // 2. Filter by class eligibility if assigned to a specific class
  // 3. STRICTLY strip correct answers and explanations to prevent cheating
  if (req.user?.role === 'learner') {
    const learnerClassId = req.user.classId;
    const activeQuizzes = allQuizzes
      .filter((q) => {
        const isEligibleStatus = ['published', 'in_progress', 'closed', 'results_released'].includes(q.status);
        if (!isEligibleStatus) return false;
        if (q.classId && q.classId !== 'all' && learnerClassId && q.classId !== learnerClassId) {
          return false;
        }
        return true;
      })
      .map((q) => ({
        ...q,
        questions: q.questions.map((qu) => {
          const { correctAnswer, explanation, ...safeQuestion } = qu;
          return safeQuestion;
        }),
      }));
    res.json({ quizzes: activeQuizzes });
    return;
  }

  // Teachers and Admins receive all quizzes in their school
  res.json({ quizzes: allQuizzes });
});

// 5. Get Single Quiz by ID (Strict Answer-Key Masking & Class Eligibility)
app.get('/api/quizzes/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Assessment quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  // Learner access enforcement
  if (req.user?.role === 'learner') {
    // Check publication status
    if (quiz.status === 'draft') {
      res.status(403).json({ error: 'Assessment is not published yet.' });
      return;
    }

    // Check class eligibility
    if (quiz.classId && quiz.classId !== 'all' && req.user.classId && quiz.classId !== req.user.classId) {
      res.status(403).json({ error: `Assessment is assigned to class ${quiz.className || quiz.classId}, not your class.` });
      return;
    }

    const quizSubmissions = await databaseAdapter.getSubmissionsByQuiz(quiz.id);
    const submission = quizSubmissions.find(
      (s) => s.quizId === quiz.id && (s.learnerId === req.user!.id || s.learnerId === req.user!.studentNumber)
    );

    // If results are formally released AND learner completed assessment, provide educational explanations
    if (quiz.status === 'results_released' && submission) {
      res.json({ quiz });
      return;
    }

    // Otherwise strictly strip answer keys and explanations
    const safeQuiz = {
      ...quiz,
      questions: quiz.questions.map((qu) => {
        const { correctAnswer, explanation, ...safeQuestion } = qu;
        return safeQuestion;
      }),
    };
    res.json({ quiz: safeQuiz });
    return;
  }

  // Teachers / Admins receive full quiz definition
  res.json({ quiz });
});

// Helper for question validation
function validateQuizQuestions(questions: any[]): { isValid: boolean; error?: string } {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { isValid: false, error: 'Assessment must include at least one question.' };
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.prompt || typeof q.prompt !== 'string' || !q.prompt.trim()) {
      return { isValid: false, error: `Question #${i + 1} has an empty prompt.` };
    }
    if (typeof q.marks !== 'number' || q.marks <= 0) {
      return { isValid: false, error: `Question #${i + 1} must have positive marks awarded.` };
    }
    if (q.type === 'multiple_choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return { isValid: false, error: `Multiple-choice question #${i + 1} must have at least 2 options.` };
      }
      const optionIds = q.options.map((opt: any) => String(opt.id || ''));
      if (!q.correctAnswer || !optionIds.includes(String(q.correctAnswer))) {
        return { isValid: false, error: `Question #${i + 1} correctAnswer must match one of its option IDs.` };
      }
    } else if (q.type === 'true_false') {
      const ans = String(q.correctAnswer || '').toLowerCase();
      if (ans !== 'true' && ans !== 'false') {
        return { isValid: false, error: `True/false question #${i + 1} correctAnswer must be 'true' or 'false'.` };
      }
    } else if (q.type === 'short_answer') {
      if (!q.correctAnswer || typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) {
        return { isValid: false, error: `Short answer question #${i + 1} must define an expected answer key.` };
      }
    }
  }
  return { isValid: true };
}

// 6. Create Quiz / Assessment (Draft or Published)
app.post('/api/quizzes', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const {
    title,
    grade,
    classId,
    className,
    subjectId,
    subjectName,
    topicsCovered,
    learningObjectives,
    difficulty,
    durationMinutes,
    instructions,
    questions = [],
    status = 'draft',
    releasePolicy = 'manual',
    allowOffline = true,
    maxAttempts = 1,
    dueDate,
  } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'Assessment title is required.' });
    return;
  }
  if (!grade || typeof grade !== 'string') {
    res.status(400).json({ error: 'Grade specification is required.' });
    return;
  }
  if (!classId || typeof classId !== 'string') {
    res.status(400).json({ error: 'Class assignment (classId) is required.' });
    return;
  }

  // If creating directly in published/in_progress state, strictly validate questions
  if (status === 'published' || status === 'in_progress') {
    const qVal = validateQuizQuestions(questions);
    if (!qVal.isValid) {
      res.status(400).json({ error: qVal.error });
      return;
    }
  }

  const newQuiz: Quiz = {
    id: req.body.id || `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim(),
    grade,
    classId,
    className: className || classId,
    subjectId: subjectId || 'subj-general',
    subjectName: subjectName || 'General',
    topicsCovered: Array.isArray(topicsCovered) ? topicsCovered : [],
    learningObjectives: learningObjectives || '',
    difficulty: difficulty || 'medium',
    durationMinutes: Number(durationMinutes) || 15,
    instructions: instructions || 'Answer all questions carefully.',
    questions: Array.isArray(questions) ? questions : [],
    status: status || 'draft',
    releasePolicy: releasePolicy || 'manual',
    allowOffline: Boolean(allowOffline),
    maxAttempts: Number(maxAttempts) || 1,
    dueDate: dueDate || undefined,
    authorId: req.user!.id,
    authorName: req.user!.name || 'Teacher',
    createdAt: new Date().toISOString(),
    publishedAt: status === 'published' || status === 'in_progress' ? new Date().toISOString() : undefined,
  };

  try {
    const saved = await databaseAdapter.saveQuiz(newQuiz, req.user?.schoolId);

    await logAuditEvent({
      action: 'QUIZ_CREATED',
      actorId: req.user!.id,
      actorRole: req.user!.role,
      targetEntity: 'quizzes',
      targetId: saved.id,
      metadata: { title: saved.title, status: saved.status, questionCount: saved.questions.length },
    });

    res.status(201).json({ quiz: saved });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to save assessment: ${err?.message || 'Unknown error'}` });
  }
});

// 7. Update Quiz (Drafts edit freely; Questions locked if submissions exist)
app.put('/api/quizzes/:id', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  const existingSubs = await databaseAdapter.getSubmissionsByQuiz(quiz.id);

  // If submissions exist, prevent modifying questions or answer keys to preserve integrity
  if (existingSubs.length > 0 && req.body.questions !== undefined) {
    const isQuestionsModified = JSON.stringify(quiz.questions) !== JSON.stringify(req.body.questions);
    if (isQuestionsModified) {
      res.status(400).json({
        error: 'Cannot modify question structure or answer keys because learner submissions have already been recorded for this assessment.',
      });
      return;
    }
  }

  // Teacher ownership check: only admin or the authoring teacher may modify
  if (req.user?.role === 'teacher' && quiz.authorId && quiz.authorId !== req.user.id) {
    res.status(403).json({ error: 'Teachers may only modify their own assessments.' });
    return;
  }

  // If questions are provided on draft or before any submissions, validate them
  if (req.body.questions !== undefined && (quiz.status === 'published' || quiz.status === 'in_progress' || req.body.status === 'published')) {
    const qVal = validateQuizQuestions(req.body.questions);
    if (!qVal.isValid) {
      res.status(400).json({ error: qVal.error });
      return;
    }
  }

  const updated: Quiz = {
    ...quiz,
    title: req.body.title !== undefined ? String(req.body.title).trim() : quiz.title,
    grade: req.body.grade || quiz.grade,
    classId: req.body.classId || quiz.classId,
    className: req.body.className || quiz.className,
    subjectId: req.body.subjectId || quiz.subjectId,
    subjectName: req.body.subjectName || quiz.subjectName,
    topicsCovered: req.body.topicsCovered || quiz.topicsCovered,
    learningObjectives: req.body.learningObjectives !== undefined ? req.body.learningObjectives : quiz.learningObjectives,
    difficulty: req.body.difficulty || quiz.difficulty,
    durationMinutes: req.body.durationMinutes !== undefined ? Number(req.body.durationMinutes) : quiz.durationMinutes,
    instructions: req.body.instructions !== undefined ? req.body.instructions : quiz.instructions,
    questions: (existingSubs.length === 0 && req.body.questions !== undefined) ? req.body.questions : quiz.questions,
    releasePolicy: req.body.releasePolicy || quiz.releasePolicy,
    allowOffline: req.body.allowOffline !== undefined ? Boolean(req.body.allowOffline) : quiz.allowOffline,
    maxAttempts: req.body.maxAttempts !== undefined ? Number(req.body.maxAttempts) : quiz.maxAttempts,
    dueDate: req.body.dueDate !== undefined ? req.body.dueDate : quiz.dueDate,
  };

  const saved = await databaseAdapter.saveQuiz(updated, req.user?.schoolId);

  await logAuditEvent({
    action: 'QUIZ_UPDATED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'quizzes',
    targetId: saved.id,
  });

  res.json({ quiz: saved });
});

// 8. Publish Quiz with Cohort Assignment & Question Validation
app.post('/api/quizzes/:id/publish', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  // Teacher ownership check: only admin or the authoring teacher may publish
  if (req.user?.role === 'teacher' && quiz.authorId && quiz.authorId !== req.user.id) {
    res.status(403).json({ error: 'Teachers may only publish their own assessments.' });
    return;
  }

  // Pre-publish validation
  const qVal = validateQuizQuestions(quiz.questions);
  if (!qVal.isValid) {
    res.status(400).json({ error: `Cannot publish assessment: ${qVal.error}` });
    return;
  }

  if (!quiz.classId || quiz.classId.trim() === '') {
    res.status(400).json({ error: 'Cannot publish assessment without assigning an eligible class cohort.' });
    return;
  }

  const updated = await databaseAdapter.updateQuizStatus(quiz.id, 'in_progress');

  await logAuditEvent({
    action: 'QUIZ_PUBLISHED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'quizzes',
    targetId: quiz.id,
    metadata: { assignedClass: quiz.className || quiz.classId, questionCount: quiz.questions.length },
  });

  res.json({ quiz: updated, message: 'Assessment published successfully to class cohort.' });
});

// 9. Assign Quiz to Class Cohort
app.post('/api/quizzes/:id/assign', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  // Teacher ownership check: only admin or the authoring teacher may assign
  if (req.user?.role === 'teacher' && quiz.authorId && quiz.authorId !== req.user.id) {
    res.status(403).json({ error: 'Teachers may only assign their own assessments.' });
    return;
  }

  const { classId, className } = req.body;
  if (!classId || typeof classId !== 'string') {
    res.status(400).json({ error: 'Target classId is required.' });
    return;
  }

  const updatedQuiz: Quiz = {
    ...quiz,
    classId,
    className: className || classId,
  };

  const saved = await databaseAdapter.saveQuiz(updatedQuiz, req.user?.schoolId);

  await logAuditEvent({
    action: 'QUIZ_ASSIGNED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'quizzes',
    targetId: quiz.id,
    metadata: { classId, className: updatedQuiz.className },
  });

  res.json({ quiz: saved, message: `Assessment successfully assigned to ${saved.className}.` });
});

// 10. Delete Quiz (Protected: Blocked if learner submissions exist)
app.delete('/api/quizzes/:id', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  const existingSubs = await databaseAdapter.getSubmissionsByQuiz(quiz.id);
  if (existingSubs.length > 0) {
    res.status(400).json({
      error: `Cannot delete assessment "${quiz.title}" because ${existingSubs.length} learner submission(s) have already been recorded. Close or archive the assessment instead.`,
    });
    return;
  }

  // Teacher ownership check: only admin or the authoring teacher may delete
  if (req.user?.role === 'teacher' && quiz.authorId && quiz.authorId !== req.user.id) {
    res.status(403).json({ error: 'Teachers may only delete their own assessments.' });
    return;
  }

  const deleted = await databaseAdapter.deleteQuiz(quiz.id);
  if (!deleted) {
    res.status(500).json({ error: 'Failed to delete quiz from registry.' });
    return;
  }

  await logAuditEvent({
    action: 'QUIZ_DELETED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'quizzes',
    targetId: req.params.id,
    metadata: { title: quiz.title },
  });

  res.json({ success: true, message: `Assessment "${quiz.title}" was deleted successfully.` });
});

// 11. View Submissions for Specific Quiz (Teacher / Admin Only)
app.get('/api/quizzes/:id/submissions', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  // Teacher class allocation check: teacher must be assigned to this class or be the quiz author
  if (
    req.user?.role === 'teacher' &&
    req.user.assignedClasses &&
    req.user.assignedClasses.length > 0 &&
    quiz.classId &&
    quiz.classId !== 'all' &&
    !req.user.assignedClasses.includes(quiz.classId) &&
    quiz.authorId !== req.user.id
  ) {
    res.status(403).json({ error: 'Access denied: assessment is assigned to a class outside your teaching allocation.' });
    return;
  }

  const submissions = await databaseAdapter.getSubmissionsByQuiz(req.params.id);
  res.json({
    quizId: quiz.id,
    quizTitle: quiz.title,
    totalSubmissions: submissions.length,
    submissions,
  });
});

// 12. Teacher Manual Feedback & Marks Adjustment (Teacher / Admin Only)
app.put('/api/submissions/:id/feedback', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const submission = await databaseAdapter.getSubmissionById(req.params.id);
  if (!submission) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(submission.quizId);
  if (!isAuthorizedSchool(quiz?.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: submission belongs to an assessment at a different school.' });
    return;
  }

  if (
    req.user?.role === 'teacher' &&
    quiz &&
    quiz.authorId !== req.user.id &&
    req.user.assignedClasses &&
    req.user.assignedClasses.length > 0 &&
    quiz.classId &&
    quiz.classId !== 'all' &&
    !req.user.assignedClasses.includes(quiz.classId)
  ) {
    res.status(403).json({ error: 'Access denied: submission belongs to a class outside your teaching allocation.' });
    return;
  }

  const { teacherFeedback, adjustedScore } = req.body;
  let scoreNum: number | undefined;

  if (adjustedScore !== undefined) {
    scoreNum = Number(adjustedScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > submission.totalMarks) {
      res.status(400).json({ error: `Adjusted score must be a number between 0 and total marks (${submission.totalMarks}).` });
      return;
    }
  }

  const updatedSubmission = await databaseAdapter.updateSubmissionFeedback(
    submission.id,
    teacherFeedback !== undefined ? String(teacherFeedback).trim() : undefined,
    scoreNum
  );

  await logAuditEvent({
    action: 'SUBMISSION_FEEDBACK_RECORDED',
    actorId: req.user!.id,
    actorRole: req.user!.role,
    targetEntity: 'submissions',
    targetId: submission.id,
    metadata: { score: updatedSubmission.score, percentage: updatedSubmission.percentage },
  });

  res.json({ submission: updatedSubmission, message: 'Teacher feedback recorded successfully.' });
});

// 13. Release Results Endpoint (Teacher / Admin Only)
app.post('/api/quizzes/:id/release-results', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  // Teacher authorization check: must be admin, author, or allocated to this class
  if (
    req.user?.role === 'teacher' &&
    quiz.authorId !== req.user.id &&
    req.user.assignedClasses &&
    req.user.assignedClasses.length > 0 &&
    quiz.classId &&
    quiz.classId !== 'all' &&
    !req.user.assignedClasses.includes(quiz.classId)
  ) {
    res.status(403).json({ error: 'Teachers may only release results for their own assessments or assigned classes.' });
    return;
  }

  const updatedQuiz = await databaseAdapter.updateQuizStatus(req.params.id, 'results_released');

  // Mark all associated submissions as 'marked' so learners can view their scores
  const submissions = await databaseAdapter.getSubmissionsByQuiz(req.params.id);
  for (const sub of submissions) {
    await databaseAdapter.saveSubmission({ ...sub, status: 'marked' }, req.user?.schoolId);
  }

  await logAuditEvent({
    action: 'RESULTS_RELEASED',
    actorId: req.user?.id,
    actorRole: req.user?.role,
    targetEntity: 'quizzes',
    targetId: req.params.id,
    metadata: { submissionCount: submissions.length },
  });

  res.json({ quiz: updatedQuiz, message: 'Results released successfully.' });
});

// 14. Printable Examination Paper (Candidate Export - answers & explanations stripped for learners)
app.get('/api/quizzes/:id/paper', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Assessment quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  // Learner access enforcement
  if (req.user?.role === 'learner') {
    if (quiz.status === 'draft') {
      res.status(403).json({ error: 'Assessment is not published yet.' });
      return;
    }
    if (quiz.classId && quiz.classId !== 'all' && req.user.classId && quiz.classId !== req.user.classId) {
      res.status(403).json({ error: `Assessment is assigned to class ${quiz.className || quiz.classId}, not your class.` });
      return;
    }
  }

  const totalMarks = quiz.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  // Student printable paper: correctAnswer and explanation are strictly stripped
  const paper = {
    institution: 'Growing Minds Academy',
    motto: 'Excellence • Integrity • Curiosity',
    documentType: 'Official Assessment Examination Paper',
    quizId: quiz.id,
    title: quiz.title,
    grade: quiz.grade,
    classId: quiz.classId,
    className: quiz.className,
    subjectName: quiz.subjectName,
    durationMinutes: quiz.durationMinutes,
    totalMarks,
    questionCount: quiz.questions.length,
    instructions: quiz.instructions || 'Read all questions carefully before answering. Attempt all questions and record answers in designated areas.',
    questions: quiz.questions.map((q, idx) => ({
      number: idx + 1,
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      marks: q.marks,
      topic: q.topic,
      options: q.options ? q.options.map((opt) => ({ id: opt.id, text: opt.text })) : undefined,
    })),
  };

  res.json({ paper });
});

// 15. Staff Answer Key & Mark Scheme (Teacher / Admin Only - Forbidden to Learners)
app.get('/api/quizzes/:id/answer-key', requireAuth, requireRole(['admin', 'teacher']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Assessment quiz not found.' });
    return;
  }

  // School boundary check
  if (!isAuthorizedSchool(quiz.schoolId, req.user?.schoolId)) {
    res.status(403).json({ error: 'Access denied: assessment belongs to a different school.' });
    return;
  }

  // Teacher authorization check: must be admin, author, or allocated to class
  if (
    req.user?.role === 'teacher' &&
    quiz.authorId !== req.user.id &&
    req.user.assignedClasses &&
    req.user.assignedClasses.length > 0 &&
    quiz.classId &&
    quiz.classId !== 'all' &&
    !req.user.assignedClasses.includes(quiz.classId)
  ) {
    res.status(403).json({ error: 'Teachers may only access answer keys for their own assessments or assigned classes.' });
    return;
  }

  const totalMarks = quiz.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  await logAuditEvent({
    schoolId: quiz.schoolId,
    action: 'ANSWER_KEY_ACCESSED',
    actorId: req.user?.id,
    actorRole: req.user?.role,
    targetEntity: 'quizzes',
    targetId: quiz.id,
    metadata: { questionCount: quiz.questions.length, totalMarks },
  });

  const answerKey = {
    institution: 'Growing Minds Academy',
    isConfidential: true,
    confidentialityNotice: 'CONFIDENTIAL — FOR AUTHORIZED TEACHING STAFF ONLY. STRICTLY PROHIBITED FROM STUDENT ACCESS.',
    documentType: 'Official Teacher Answer Key & Mark Scheme',
    quizId: quiz.id,
    title: quiz.title,
    grade: quiz.grade,
    classId: quiz.classId,
    className: quiz.className,
    subjectName: quiz.subjectName,
    durationMinutes: quiz.durationMinutes,
    totalMarks,
    questionCount: quiz.questions.length,
    releasePolicy: quiz.releasePolicy,
    authorName: quiz.authorName,
    questions: quiz.questions.map((q, idx) => ({
      number: idx + 1,
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      marks: q.marks,
      topic: q.topic,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'Verified curriculum standard answer.',
    })),
  };

  res.json({ answerKey });
});

// ----------------------------------------------------------------------------
// ASSESSMENT SUBMISSION & SYNC ENDPOINTS
// ----------------------------------------------------------------------------

// 7. Assessment Submission (Server-side Auto-Marking, Attempt Limits & Idempotency)
app.post('/api/submissions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const { quizId, answers, clientSubmissionHash, isOfflineSubmission, submittedAt } = req.body;

  if (!quizId || !answers || typeof answers !== 'object') {
    res.status(400).json({ error: 'quizId and answers object are required.' });
    return;
  }

  const quiz = await databaseAdapter.getQuizById(quizId);
  if (!quiz) {
    res.status(404).json({ error: 'Assessment quiz not found.' });
    return;
  }

  // Validate quiz is actively accepting submissions
  if (quiz.status === 'draft' || quiz.status === 'closed') {
    res.status(400).json({ error: `Assessment is not currently accepting submissions (status: ${quiz.status}).` });
    return;
  }

  // Check deadline if configured
  if (quiz.dueDate && new Date(quiz.dueDate) < new Date()) {
    res.status(400).json({ error: `Assessment deadline (${new Date(quiz.dueDate).toLocaleString()}) has expired.` });
    return;
  }

  // Enforce learner identity: cannot submit for another student
  if (req.user?.role === 'learner' && req.body.learnerId) {
    const requestedLearnerId = String(req.body.learnerId).trim();
    if (requestedLearnerId !== req.user.id && requestedLearnerId !== req.user.studentNumber) {
      res.status(403).json({ error: 'Learners cannot submit assessments on behalf of another student.' });
      return;
    }
  }

  const learnerId = req.user!.id;
  const studentNum = req.user!.studentNumber || learnerId;

  // Check class eligibility for learners
  if (req.user?.role === 'learner' && quiz.classId && quiz.classId !== 'all' && req.user.classId && quiz.classId !== req.user.classId) {
    res.status(403).json({ error: `Assessment is assigned to ${quiz.className || quiz.classId}, not your class.` });
    return;
  }

  // Idempotency: verify hash has not already been submitted (checks before attempt count)
  if (clientSubmissionHash) {
    const existing = await databaseAdapter.getSubmissionByHash(clientSubmissionHash);
    if (existing) {
      res.status(200).json({
        submission: existing,
        isDuplicate: true,
        message: 'Submission already recorded (idempotent).',
      });
      return;
    }
  }

  // Check attempt limits
  const quizSubs = await databaseAdapter.getSubmissionsByQuiz(quiz.id);
  const existingAttempts = quizSubs.filter(
    (s) => s.learnerId === learnerId || s.learnerId === studentNum
  );
  const maxAttempts = quiz.maxAttempts || 1;
  if (existingAttempts.length >= maxAttempts) {
    res.status(400).json({ error: `Maximum attempt limit of ${maxAttempts} has already been reached for this quiz.` });
    return;
  }

  // Server-Side Marking against author key (Never trust client-supplied marks or score)
  let score = 0;
  let totalMarks = 0;
  const topicsToPractise: string[] = [];

  quiz.questions.forEach((q) => {
    totalMarks += q.marks;
    const learnerAns = String(answers[q.id] || '').trim().toLowerCase();
    const correctAns = String(q.correctAnswer || '').trim().toLowerCase();

    const isCorrect = learnerAns === correctAns;
    if (isCorrect) {
      score += q.marks;
    } else if (q.topic && !topicsToPractise.includes(q.topic)) {
      topicsToPractise.push(q.topic);
    }
  });

  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const isAutoRelease = quiz.releasePolicy === 'automatic' || quiz.status === 'results_released';
  const submissionStatus = isAutoRelease ? 'marked' : 'submitted';

  const newSubmission: Submission = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    quizId: quiz.id,
    quizTitle: quiz.title,
    subjectName: quiz.subjectName,
    learnerId,
    learnerName: req.user!.name || 'Student',
    classId: quiz.classId,
    className: quiz.className,
    score,
    totalMarks,
    percentage,
    status: submissionStatus,
    syncStatus: 'synced',
    isOfflineSubmission: Boolean(isOfflineSubmission),
    clientSubmissionHash: clientSubmissionHash || `hash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    submittedAt: submittedAt || new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    topicsToPractise,
    answers,
  };

  const saved = await databaseAdapter.saveSubmission(newSubmission, req.user?.schoolId);

  await logAuditEvent({
    action: 'SUBMISSION_RECORDED',
    actorId: learnerId,
    actorRole: req.user!.role,
    targetEntity: 'submissions',
    targetId: saved.id,
    metadata: { quizId: quiz.id, score, percentage, isOffline: isOfflineSubmission },
  });

  // If requester is learner and manual release policy is active, withhold marks in response
  if (req.user?.role === 'learner' && !isAutoRelease && quiz.status !== 'results_released') {
    const masked = {
      ...saved,
      score: 0,
      percentage: 0,
      teacherFeedback: 'Assessment recorded. Marks will be released by your class teacher.',
    };
    res.json({ submission: masked, isDuplicate: false });
    return;
  }

  res.json({ submission: saved, isDuplicate: false });
});

// 8. Offline Submissions Batch Sync (Hardened: Idempotent, Per-Item Validation & Trusted Auto-Marking)
app.post('/api/submissions/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'items must be an array of queued submissions.' });
    return;
  }

  let syncedCount = 0;
  let skippedDuplicates = 0;
  let rejectedCount = 0;
  const results: any[] = [];

  for (const item of items) {
    const id = item.id || `item-${Date.now()}`;
    const hash = item.clientSubmissionHash || item.submission?.clientSubmissionHash;

    // Idempotency check: if hash already recorded, mark as duplicate without error
    if (hash) {
      const existing = await databaseAdapter.getSubmissionByHash(hash);
      if (existing) {
        skippedDuplicates++;
        results.push({
          id,
          status: 'synced',
          isDuplicate: true,
          submissionId: existing.id,
          message: 'Submission already recorded (idempotent).',
        });
        continue;
      }
    }

    const quizId = item.submission?.quizId || item.quizId;
    if (!quizId) {
      rejectedCount++;
      results.push({ id, status: 'rejected', reason: 'Missing quizId.' });
      continue;
    }

    const quiz = await databaseAdapter.getQuizById(quizId);
    if (!quiz) {
      rejectedCount++;
      results.push({ id, status: 'rejected', reason: `Quiz "${quizId}" not found.` });
      continue;
    }

    if (quiz.status === 'draft') {
      rejectedCount++;
      results.push({ id, status: 'rejected', reason: 'Quiz is in draft mode.' });
      continue;
    }

    if (quiz.dueDate && new Date(quiz.dueDate) < new Date()) {
      rejectedCount++;
      results.push({ id, status: 'rejected', reason: 'Assessment deadline has expired.' });
      continue;
    }

    // Enforce learner identity: cannot impersonate another learner
    const itemLearnerId = item.submission?.learnerId || item.learnerId;
    if (req.user?.role === 'learner' && itemLearnerId) {
      const cleanItemLearner = String(itemLearnerId).trim();
      if (cleanItemLearner !== req.user.id && cleanItemLearner !== req.user.studentNumber) {
        rejectedCount++;
        results.push({ id, status: 'rejected', reason: 'Impersonation rejected: learner cannot submit on behalf of another student.' });
        continue;
      }
    }

    const learnerId = req.user?.role === 'learner' ? req.user.id : (item.submission?.learnerId || req.user?.id || 'learner-unknown');
    const studentNum = req.user?.role === 'learner' ? (req.user.studentNumber || req.user.id) : (item.submission?.learnerId || learnerId);

    // Class eligibility check
    if (req.user?.role === 'learner' && quiz.classId && quiz.classId !== 'all' && req.user.classId && quiz.classId !== req.user.classId) {
      rejectedCount++;
      results.push({ id, status: 'rejected', reason: `Quiz assigned to ${quiz.className || quiz.classId}, not learner class.` });
      continue;
    }

    // Attempt limit check
    const quizAttempts = await databaseAdapter.getSubmissionsByQuiz(quiz.id);
    const existingAttempts = quizAttempts.filter(
      (s) => s.learnerId === learnerId || s.learnerId === studentNum
    );
    const maxAttempts = quiz.maxAttempts || 1;
    if (existingAttempts.length >= maxAttempts) {
      rejectedCount++;
      results.push({ id, status: 'rejected', reason: `Maximum attempt limit (${maxAttempts}) exceeded for this quiz.` });
      continue;
    }

    // Trusted server-side mark calculation: NEVER trust client-supplied marks or score
    const rawAnswers = item.submission?.answers || item.answers || {};
    let score = 0;
    let totalMarks = 0;
    const topicsToPractise: string[] = [];

    quiz.questions.forEach((q) => {
      totalMarks += q.marks;
      const learnerAns = String(rawAnswers[q.id] || '').trim().toLowerCase();
      const correctAns = String(q.correctAnswer || '').trim().toLowerCase();

      const isCorrect = learnerAns === correctAns;
      if (isCorrect) {
        score += q.marks;
      } else if (q.topic && !topicsToPractise.includes(q.topic)) {
        topicsToPractise.push(q.topic);
      }
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const isAutoRelease = quiz.releasePolicy === 'automatic' || quiz.status === 'results_released';
    const submissionStatus = isAutoRelease ? 'marked' : 'submitted';

    const saved = await databaseAdapter.saveSubmission(
      {
        id: item.submission?.id || `sub-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        quizId: quiz.id,
        quizTitle: quiz.title,
        subjectName: quiz.subjectName,
        learnerId,
        learnerName: req.user?.name || item.submission?.learnerName || 'Student',
        classId: quiz.classId,
        className: quiz.className,
        score,
        totalMarks,
        percentage,
        status: submissionStatus,
        syncStatus: 'synced',
        isOfflineSubmission: true,
        clientSubmissionHash: hash || `hash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        submittedAt: item.submission?.submittedAt || item.submittedAt || new Date().toISOString(),
        syncedAt: new Date().toISOString(),
        topicsToPractise,
        answers: rawAnswers,
      },
      req.user?.schoolId
    );

    syncedCount++;
    results.push({ id, status: 'synced', isDuplicate: false, submissionId: saved.id });
  }

  await logAuditEvent({
    action: 'OFFLINE_SYNC_BATCH',
    actorId: req.user?.id,
    actorRole: req.user?.role,
    targetEntity: 'submissions',
    metadata: { syncedCount, skippedDuplicates, rejectedCount, totalReceived: items.length },
  });

  res.json({
    syncedCount,
    skippedDuplicates,
    rejectedCount,
    totalReceived: items.length,
    results,
  });
});

// 9. Learner Results (Withholds Unreleased Assessments & Scoped to Requester)
app.get('/api/learners/results', requireAuth, requireRole(['learner']), async (req: Request, res: Response): Promise<void> => {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Production storage is unavailable. Database connection required.' });
    return;
  }

  const userId = req.user!.id;
  const userNum = req.user!.studentNumber || userId;

  const submissions = await databaseAdapter.getSubmissionsByLearner(userId, userNum);

  const safeResults = await Promise.all(
    submissions.map(async (sub) => {
      const quiz = await databaseAdapter.getQuizById(sub.quizId);
      const isReleased = quiz?.status === 'results_released' || quiz?.releasePolicy === 'automatic';

      if (!isReleased) {
        return {
          ...sub,
          score: 0,
          percentage: 0,
          teacherFeedback: 'Assessment completed. Awaiting teacher marks release.',
          answers: {},
        };
      }
      return sub;
    })
  );

  res.json({ submissions: safeResults });
});


// Gemini AI Quiz Generation Endpoint
interface QuizGenRequestBody {
  grade?: string;
  subject?: string;
  topics?: string[];
  learningObjectives?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount?: number;
  questionType?: 'multiple_choice' | 'true_false' | 'short_answer';
}

app.post('/api/ai/generate-quiz', async (req: Request<{}, {}, QuizGenRequestBody>, res: Response): Promise<void> => {
  try {
    // Check Authorization if provided
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const learner = verifyLearnerToken(token);
      if (learner) {
        res.status(403).json({ error: 'Forbidden: Learners are not authorized to generate quiz questions.' });
        return;
      }
      const staff = verifyStaffToken(token);
      if (staff) {
        req.user = staff;
      }
    }

    if (isProduction && (!req.user || (req.user.role !== 'admin' && req.user.role !== 'teacher'))) {
      res.status(401).json({ error: 'Authentication required. Only authorized staff may generate assessment questions.' });
      return;
    }

    const {
      grade = 'Grade 3',
      subject = 'Mathematics',
      topics = ['General Knowledge'],
      learningObjectives = '',
      difficulty = 'medium',
      questionCount = 3,
      questionType,
    } = req.body;

    // Validate inputs
    if (typeof grade !== 'string' || grade.length > 50) {
      res.status(400).json({ error: 'Invalid or oversized grade specification.' });
      return;
    }
    if (typeof subject !== 'string' || subject.length > 100) {
      res.status(400).json({ error: 'Invalid or oversized subject specification.' });
      return;
    }
    if (!Array.isArray(topics) || topics.length === 0 || topics.length > 10) {
      res.status(400).json({ error: 'Topics must be an array containing between 1 and 10 items.' });
      return;
    }
    for (const t of topics) {
      if (typeof t !== 'string' || t.length > 100) {
        res.status(400).json({ error: 'Topic title exceeds allowed length.' });
        return;
      }
    }
    const count = Number(questionCount);
    if (isNaN(count) || count < 1 || count > 50) {
      res.status(400).json({ error: 'Question count must be between 1 and 50.' });
      return;
    }

    const MAX_BATCH_SIZE = 8;
    const batches: number[] = [];
    let rem = count;
    while (rem > 0) {
      const bSize = Math.min(rem, MAX_BATCH_SIZE);
      batches.push(bSize);
      rem -= bSize;
    }

    const accumulatedQuestions: any[] = [];
    const usedPromptKeys = new Set<string>();
    let isPartial = false;
    let partialWarning: string | undefined = undefined;

    const apiKey = process.env.GEMINI_API_KEY;

    // AI question generation is only truthful when a real Gemini API key is
    // configured. There is deliberately NO synthetic/local fallback: if the key
    // is missing or a placeholder, the request fails with an explicit error
    // rather than silently returning fabricated questions presented as AI output.
    if (!isGeminiConfigured()) {
      res.status(503).json({
        error:
          'AI question generation is unavailable: GEMINI_API_KEY is not configured on the server. ' +
          'Set a valid key in the server environment (.env) to enable AI generation. ' +
          'You can still author questions manually in the quiz wizard.',
      });
      return;
    }

    // Live Gemini API with batching and deduplication
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are a senior primary school educator and curriculum assessment author for Growing Minds Academy.
Your task is to draft high quality assessment questions aligned with the requested grade level, subject, and curriculum topics.
Questions must be clear, unambiguous, age-appropriate, and contain an accurate answer key and pedagogical explanation.
For multiple-choice questions, provide exactly 4 distinct options with one clearly correct answer.
Option IDs must be 'opt-1', 'opt-2', 'opt-3', 'opt-4', and correctAnswer must match the correct option id.
For true_false questions, correctAnswer must be 'true' or 'false'.
For short_answer questions, correctAnswer must be a concise, standard string (e.g. '1/4' or 'Gravity').`;

    for (let bIndex = 0; bIndex < batches.length; bIndex++) {
      const currentBatchSize = batches[bIndex];
      const existingPrompts = accumulatedQuestions.map((q) => q.prompt);

      const promptText = `Generate ${currentBatchSize} unique curriculum assessment questions for:
Grade: ${grade}
Subject: ${subject}
Topics: ${topics.join(', ')}
${learningObjectives ? `Learning Objectives: ${learningObjectives}` : ''}
Difficulty Tier: ${difficulty}
${questionType ? `Forced Question Type: ${questionType}` : 'Question Type: prioritize multiple_choice with optional true_false and short_answer'}
${
  existingPrompts.length > 0
    ? `\nCRITICAL DEDUPLICATION RULE: The following ${existingPrompts.length} questions have already been generated for this exam paper. DO NOT duplicate, rephrase, or overlap these concepts:\n${existingPrompts.slice(-10).map((p, i) => `- ${p}`).join('\n')}`
    : ''
}`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              description: 'A list of generated assessment questions.',
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "Type of question: 'multiple_choice', 'true_false', or 'short_answer'",
                  },
                  prompt: {
                    type: Type.STRING,
                    description: 'The clear question prompt presented to the learner.',
                  },
                  options: {
                    type: Type.ARRAY,
                    description: 'Answer options for multiple-choice questions.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING },
                      },
                      required: ['id', 'text'],
                    },
                  },
                  correctAnswer: {
                    type: Type.STRING,
                    description: 'Correct option id (for multiple_choice), true/false string, or exact text key.',
                  },
                  marks: {
                    type: Type.INTEGER,
                    description: 'Marks awarded for correct answer (typically 1 or 2).',
                  },
                  topic: {
                    type: Type.STRING,
                    description: 'Specific topic tag from the provided syllabus topics.',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Pedagogical explanation shown to teacher or after result release.',
                  },
                },
                required: ['type', 'prompt', 'correctAnswer', 'marks', 'topic'],
              },
            },
          },
        });

        const outputText = response.text?.trim() || '[]';
        let rawQuestions: any[] = [];
        try {
          rawQuestions = JSON.parse(outputText);
        } catch {
          if (accumulatedQuestions.length > 0) {
            isPartial = true;
            partialWarning = `Generated ${accumulatedQuestions.length} of ${count} questions before output parsing was interrupted.`;
            break;
          } else {
            res.status(502).json({ error: 'Model output could not be parsed as valid JSON.' });
            return;
          }
        }

        if (Array.isArray(rawQuestions)) {
          for (const q of rawQuestions) {
            const promptStr = String(q.prompt || '').trim();
            const normKey = promptStr.toLowerCase();
            if (promptStr.length > 0 && !usedPromptKeys.has(normKey)) {
              usedPromptKeys.add(normKey);
              const qIndex = accumulatedQuestions.length + 1;
              accumulatedQuestions.push({
                id: `ai-live-${Date.now()}-${qIndex}`,
                type: q.type === 'true_false' || q.type === 'short_answer' ? q.type : 'multiple_choice',
                prompt: promptStr,
                options:
                  Array.isArray(q.options) && q.options.length > 0
                    ? q.options.map((opt: any, optIdx: number) => ({
                        id: String(opt.id || `opt-${optIdx + 1}`),
                        text: String(opt.text || `Option ${optIdx + 1}`),
                      }))
                    : q.type === 'multiple_choice'
                    ? [
                        { id: 'opt-1', text: 'Option A' },
                        { id: 'opt-2', text: 'Option B' },
                        { id: 'opt-3', text: 'Option C' },
                        { id: 'opt-4', text: 'Option D' },
                      ]
                    : undefined,
                correctAnswer: String(q.correctAnswer || (q.type === 'true_false' ? 'true' : 'opt-1')),
                marks: Number(q.marks) || 2,
                topic: String(q.topic || topics[0] || 'Curriculum'),
                explanation: String(q.explanation || `Derived from ${grade} syllabus standards.`),
                isAccepted: true,
                generationNote: `Generated by Gemini 3.8 Flash (Batch ${bIndex + 1}). Verified server-side.`,
              });
            }
          }
        }
      } catch (batchErr) {
        if (accumulatedQuestions.length > 0) {
          isPartial = true;
          partialWarning = `Generated ${accumulatedQuestions.length} of ${count} questions before AI provider rate limit was reached.`;
          break;
        } else {
          throw batchErr;
        }
      }
    }

    res.json({
      questions: accumulatedQuestions,
      isPartial,
      actualCount: accumulatedQuestions.length,
      requestedCount: count,
      warning: partialWarning,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error during AI quiz generation';
    console.error('[Gemini API Error]', message);
    res.status(500).json({
      error: 'An unexpected error occurred while generating questions with Gemini AI.',
      details: isProduction ? undefined : message,
    });
  }
});

// Vite Middleware Integration
async function startServer() {
  if (!isProduction) {
    // Development: dynamically import Vite and mount dev middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static assets from dist
    const distPath = fs.existsSync(path.resolve(__dirname, 'index.html'))
      ? __dirname
      : path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server Internal Error]', err.stack || err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // Provision initial administrator darksyntax idempotently if INITIAL_ADMIN_PASSWORD is set
  if (process.env.INITIAL_ADMIN_PASSWORD) {
    try {
      const adminBoot = await bootstrapInitialAdmin();
      console.log(`[Admin Bootstrap] ${adminBoot.message}`);
    } catch (err: unknown) {
      console.error('[Admin Bootstrap Error]', err);
    }
  } else if (isProduction && !isSupabaseConfigured()) {
    console.warn('[Security Notice] INITIAL_ADMIN_PASSWORD is not set in environment.');
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`[Growing Minds Academy Server] Running at http://${HOST}:${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] Closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.env.NODE_ENV !== 'test' && process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('[Server Startup Failure]', err);
    process.exit(1);
  });
}

export { app };
