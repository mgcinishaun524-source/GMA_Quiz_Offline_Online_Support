// Persistent Database Adapter for Growing Minds Academy
// Mediates between API endpoints and persistent Supabase PostgreSQL storage.
// Fails closed: when Supabase is not configured, persistence operations refuse to
// run instead of serving or writing local in-memory fallback records.

import crypto from 'node:crypto';
import { getSupabaseAdmin, isSupabaseConfigured, logAuditEvent } from '../db.js';
import { Quiz, Question, QuizStatus } from '../../src/types/quiz.js';
import { Submission, AnswerRecord } from '../../src/types/submission.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// Known seed mappings from supabase/seed.sql
export const SEED_ID_MAP: Record<string, string> = {
  'default-school': '00000000-0000-0000-0000-000000000001',
  'subj-math': '10000000-0000-0000-0000-000000000001',
  'subj-sci': '10000000-0000-0000-0000-000000000002',
  'subj-eng': '10000000-0000-0000-0000-000000000003',
  'subj-ict': '10000000-0000-0000-0000-000000000004',
  'cls-3a': '20000000-0000-0000-0000-000000000001',
  'cls-3b': '20000000-0000-0000-0000-000000000002',
  'cls-4a': '20000000-0000-0000-0000-000000000003',
  'GMA-2026-0301': '30000000-0000-0000-0000-000000000001',
  'GMA-2026-0302': '30000000-0000-0000-0000-000000000002',
  'GMA-2026-0303': '30000000-0000-0000-0000-000000000003',
};

export function deterministicUUID(input: string): string {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = '5' + hash.substring(13, 16);
  const part4 = ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20);
  const part5 = hash.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export function resolveUUID(id?: string, defaultId?: string): string {
  if (id && isValidUUID(id)) return id;
  if (id && SEED_ID_MAP[id]) return SEED_ID_MAP[id];
  if (defaultId && isValidUUID(defaultId)) return defaultId;
  if (defaultId && SEED_ID_MAP[defaultId]) return SEED_ID_MAP[defaultId];
  if (id) return deterministicUUID(id);
  if (defaultId) return deterministicUUID(defaultId);
  return crypto.randomUUID();
}

/**
 * Derives the `questions` table primary key for a question within a quiz.
 *
 * Question IDs must be unique PER quiz row (questions_pkey is a global unique
 * constraint on the questions table, not per-quiz). When a caller supplies a
 * non-UUID question id (e.g. "q-1", "tq-1") that may legitimately be reused
 * across different quizzes, deriving the DB id from BOTH the quiz id and the
 * question id guarantees no collision on the primary key. A caller-supplied
 * valid UUID is preserved verbatim (real frontend usage generates unique
 * UUIDs per question via crypto.randomUUID()).
 */
export function questionDbId(quizId: string, qId: string): string {
  if (qId && isValidUUID(qId)) return qId;
  return deterministicUUID(`${quizId}_${qId}`);
}

export class DatabaseAdapter {
  // Guards every persistence operation. There is no local fallback storage:
  // without a configured database the operation must fail rather than pretend.
  private assertPersistence(): void {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Persistent storage is unavailable: Supabase is not configured. Local fallback storage is disabled.'
      );
    }
  }

  // ==========================================================================
  // QUIZZES
  // ==========================================================================

  public async getQuizzes(schoolId = '00000000-0000-0000-0000-000000000001'): Promise<Quiz[]> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const { data: quizRows, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        subjects:subject_id(id, name),
        classes:class_id(id, name)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (quizError) {
      throw new Error(`Database error fetching quizzes: ${quizError.message}`);
    }

    if (!quizRows || quizRows.length === 0) {
      return [];
    }

    const quizIds = quizRows.map((q) => q.id);

    // Fetch questions in batch
    const { data: questionRows, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .in('quiz_id', quizIds)
      .order('sort_order', { ascending: true });

    if (questionError) {
      throw new Error(`Database error fetching quiz questions: ${questionError.message}`);
    }

    const questionsByQuiz = new Map<string, Question[]>();
    (questionRows || []).forEach((qr) => {
      const qList = questionsByQuiz.get(qr.quiz_id) || [];
      qList.push({
        id: qr.id,
        type: qr.type,
        prompt: qr.prompt,
        options: qr.options || undefined,
        correctAnswer: qr.correct_answer,
        marks: qr.marks,
        topic: qr.topic,
        explanation: qr.explanation || undefined,
      });
      questionsByQuiz.set(qr.quiz_id, qList);
    });

    return quizRows.map((qr) => ({
      id: qr.id,
      schoolId: qr.school_id,
      title: qr.title,
      grade: qr.grade,
      classId: qr.class_id || (qr.classes?.id ?? 'all'),
      className: qr.classes?.name || 'Assigned Cohort',
      subjectId: qr.subject_id,
      subjectName: qr.subjects?.name || 'General',
      topicsCovered: qr.topics_covered || [],
      learningObjectives: qr.learning_objectives || '',
      difficulty: qr.difficulty,
      durationMinutes: qr.duration_minutes,
      instructions: qr.instructions || '',
      questions: questionsByQuiz.get(qr.id) || [],
      status: qr.status,
      releasePolicy: qr.release_policy,
      allowOffline: qr.allow_offline,
      maxAttempts: qr.max_attempts,
      dueDate: qr.due_date || undefined,
      createdAt: qr.created_at,
      publishedAt: qr.published_at || undefined,
      closedAt: qr.closed_at || undefined,
      resultsReleasedAt: qr.results_released_at || undefined,
      authorId: qr.author_id,
      authorName: 'Faculty Teacher',
    }));
  }

  public async getQuizById(id: string): Promise<Quiz | undefined> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const resolvedId = resolveUUID(id);

    const { data: qr, error: quizError } = await supabase
      .from('quizzes')
      .select(`
        *,
        subjects:subject_id(id, name),
        classes:class_id(id, name)
      `)
      .eq('id', resolvedId)
      .maybeSingle();

    if (quizError) {
      throw new Error(`Database error fetching quiz ${id}: ${quizError.message}`);
    }

    if (!qr) return undefined;

    const { data: questionRows, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', resolvedId)
      .order('sort_order', { ascending: true });

    if (questionError) {
      throw new Error(`Database error fetching questions for quiz ${id}: ${questionError.message}`);
    }

    const questions: Question[] = (questionRows || []).map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options || undefined,
      correctAnswer: q.correct_answer,
      marks: q.marks,
      topic: q.topic,
      explanation: q.explanation || undefined,
    }));

    return {
      id: qr.id,
      schoolId: qr.school_id,
      title: qr.title,
      grade: qr.grade,
      classId: qr.class_id || (qr.classes?.id ?? 'all'),
      className: qr.classes?.name || 'Assigned Cohort',
      subjectId: qr.subject_id,
      subjectName: qr.subjects?.name || 'General',
      topicsCovered: qr.topics_covered || [],
      learningObjectives: qr.learning_objectives || '',
      difficulty: qr.difficulty,
      durationMinutes: qr.duration_minutes,
      instructions: qr.instructions || '',
      questions,
      status: qr.status,
      releasePolicy: qr.release_policy,
      allowOffline: qr.allow_offline,
      maxAttempts: qr.max_attempts,
      dueDate: qr.due_date || undefined,
      createdAt: qr.created_at,
      publishedAt: qr.published_at || undefined,
      closedAt: qr.closed_at || undefined,
      resultsReleasedAt: qr.results_released_at || undefined,
      authorId: qr.author_id,
      authorName: 'Faculty Teacher',
    };
  }

  public async saveQuiz(quiz: Quiz, schoolId = '00000000-0000-0000-0000-000000000001'): Promise<Quiz> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const quizId = resolveUUID(quiz.id);
    const subjectId = resolveUUID(quiz.subjectId, '10000000-0000-0000-0000-000000000001');
    const classId = quiz.classId && quiz.classId !== 'all' ? resolveUUID(quiz.classId, '20000000-0000-0000-0000-000000000001') : null;
    const authorId = resolveUUID(quiz.authorId, '00000000-0000-0000-0000-000000000001');

    // Upsert quiz record
    const { error: quizError } = await supabase.from('quizzes').upsert({
      id: quizId,
      school_id: schoolId,
      subject_id: subjectId,
      class_id: classId,
      author_id: authorId,
      title: quiz.title,
      grade: quiz.grade,
      difficulty: quiz.difficulty,
      duration_minutes: quiz.durationMinutes,
      instructions: quiz.instructions,
      learning_objectives: quiz.learningObjectives,
      topics_covered: quiz.topicsCovered || [],
      status: quiz.status,
      release_policy: quiz.releasePolicy,
      allow_offline: quiz.allowOffline,
      max_attempts: quiz.maxAttempts,
      due_date: quiz.dueDate || null,
      published_at: quiz.publishedAt || (quiz.status === 'published' || quiz.status === 'in_progress' ? new Date().toISOString() : null),
      closed_at: quiz.closedAt || (quiz.status === 'closed' ? new Date().toISOString() : null),
      results_released_at: quiz.resultsReleasedAt || (quiz.status === 'results_released' ? new Date().toISOString() : null),
      updated_at: new Date().toISOString(),
    });

    if (quizError) {
      throw new Error(`Database error saving quiz: ${quizError.message}`);
    }

    // Synchronize quiz_assignments junction table with class cohort assignment
    if (classId) {
      await supabase.from('quiz_assignments').delete().eq('quiz_id', quizId).neq('class_id', classId);
      await supabase.from('quiz_assignments').upsert(
        {
          quiz_id: quizId,
          class_id: classId,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: 'quiz_id,class_id' }
      );
    } else {
      await supabase.from('quiz_assignments').delete().eq('quiz_id', quizId);
    }

    // Persist questions if provided
    if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
      // Delete existing questions for this quiz to prevent orphan questions
      await supabase.from('questions').delete().eq('quiz_id', quizId);

      const questionInserts = quiz.questions.map((q, idx) => ({
        // Question IDs must be unique per quiz. When the caller supplies a
        // non-UUID question id (e.g. "q-1") that may be reused across quizzes,
        // derive the DB primary key from BOTH the quiz id and the question id
        // so it never collides on the questions_pkey unique constraint.
        id: questionDbId(quizId, q.id),
        quiz_id: quizId,
        type: q.type,
        prompt: q.prompt,
        options: q.options || null,
        correct_answer: q.correctAnswer,
        marks: q.marks,
        topic: q.topic || 'General',
        explanation: q.explanation || null,
        sort_order: idx + 1,
      }));

      const { error: qInsertError } = await supabase.from('questions').insert(questionInserts);
      if (qInsertError) {
        throw new Error(`Database error saving questions: ${qInsertError.message}`);
      }
    }

    const saved = await this.getQuizById(quizId);
    if (!saved) {
      throw new Error('Failed to retrieve newly persisted quiz.');
    }
    return saved;
  }

  public async updateQuizStatus(id: string, status: QuizStatus): Promise<Quiz | null> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const quizId = resolveUUID(id);
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'published' || status === 'in_progress') {
      updatePayload.published_at = new Date().toISOString();
    } else if (status === 'closed') {
      updatePayload.closed_at = new Date().toISOString();
    } else if (status === 'results_released') {
      updatePayload.results_released_at = new Date().toISOString();
    }

    const { error } = await supabase.from('quizzes').update(updatePayload).eq('id', quizId);
    if (error) {
      throw new Error(`Database error updating status for quiz ${id}: ${error.message}`);
    }

    return this.getQuizById(quizId) as Promise<Quiz | null>;
  }

  public async deleteQuiz(id: string): Promise<boolean> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const quizId = resolveUUID(id);
    const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
    if (error) {
      throw new Error(`Database error deleting quiz ${id}: ${error.message}`);
    }
    return true;
  }

  // ==========================================================================
  // SUBMISSIONS
  // ==========================================================================

  public async getSubmissions(schoolId = '00000000-0000-0000-0000-000000000001'): Promise<Submission[]> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const { data: rows, error } = await supabase
      .from('submissions')
      .select(`
        *,
        quizzes:quiz_id(id, title, subjects:subject_id(name)),
        learners:learner_id(id, student_number, first_name, last_name, class_memberships(classes(id, name))),
        submission_answers(*)
      `)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching submissions: ${error.message}`);
    }

    return (rows || []).map((r) => this.mapSubmissionRowToModel(r));
  }

  public async getSubmissionById(id: string): Promise<Submission | undefined> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const resolvedId = resolveUUID(id);

    const { data: row, error } = await supabase
      .from('submissions')
      .select(`
        *,
        quizzes:quiz_id(id, title, subjects:subject_id(name)),
        learners:learner_id(id, student_number, first_name, last_name, class_memberships(classes(id, name))),
        submission_answers(*)
      `)
      .eq('id', resolvedId)
      .maybeSingle();

    if (error || !row) return undefined;
    return this.mapSubmissionRowToModel(row);
  }

  public async getSubmissionByHash(hash: string): Promise<Submission | undefined> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const { data: row, error } = await supabase
      .from('submissions')
      .select(`
        *,
        quizzes:quiz_id(id, title, subjects:subject_id(name)),
        learners:learner_id(id, student_number, first_name, last_name, class_memberships(classes(id, name))),
        submission_answers(*)
      `)
      .eq('client_submission_hash', hash)
      .maybeSingle();

    if (error || !row) return undefined;
    return this.mapSubmissionRowToModel(row);
  }

  public async getSubmissionsByQuiz(quizId: string): Promise<Submission[]> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const resolvedQuizId = resolveUUID(quizId);

    const { data: rows, error } = await supabase
      .from('submissions')
      .select(`
        *,
        quizzes:quiz_id(id, title, subjects:subject_id(name)),
        learners:learner_id(id, student_number, first_name, last_name, class_memberships(classes(id, name))),
        submission_answers(*)
      `)
      .eq('quiz_id', resolvedQuizId)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching submissions for quiz ${quizId}: ${error.message}`);
    }

    return (rows || []).map((r) => this.mapSubmissionRowToModel(r));
  }

  public async getSubmissionsByLearner(learnerId: string, studentNumber?: string): Promise<Submission[]> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const resolvedId = resolveUUID(learnerId, studentNumber ? SEED_ID_MAP[studentNumber] : undefined);

    const { data: rows, error } = await supabase
      .from('submissions')
      .select(`
        *,
        quizzes:quiz_id(id, title, subjects:subject_id(name)),
        learners:learner_id(id, student_number, first_name, last_name, class_memberships(classes(id, name))),
        submission_answers(*)
      `)
      .eq('learner_id', resolvedId)
      .order('submitted_at', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching learner submissions: ${error.message}`);
    }

    return (rows || []).map((r) => this.mapSubmissionRowToModel(r));
  }

  public async saveSubmission(submission: Submission, schoolId = '00000000-0000-0000-0000-000000000001'): Promise<Submission> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const subId = resolveUUID(submission.id);
    const quizId = resolveUUID(submission.quizId);
    const learnerId = resolveUUID(submission.learnerId);

    // 1. Transaction-safe / idempotent check on client_submission_hash
    if (submission.clientSubmissionHash) {
      const existing = await this.getSubmissionByHash(submission.clientSubmissionHash);
      if (existing) {
        // Monotonic state protection against stale queued retries:
        // A stale retry must never revert a 'marked' submission back to 'submitted',
        // wipe out authoritative teacher feedback, or revert an adjusted score.
        const isStatusAdvancing = existing.status === 'submitted' && submission.status === 'marked';
        const hasNewTeacherFeedback = Boolean(submission.teacherFeedback && submission.teacherFeedback !== existing.teacherFeedback);
        const isScoreUpdatedByTeacher = hasNewTeacherFeedback && submission.score !== undefined && submission.score !== existing.score;

        if (isStatusAdvancing || hasNewTeacherFeedback || isScoreUpdatedByTeacher) {
          const newStatus = isStatusAdvancing ? 'marked' : existing.status;
          const newFeedback = hasNewTeacherFeedback ? submission.teacherFeedback : existing.teacherFeedback;
          const newScore = isScoreUpdatedByTeacher ? submission.score : existing.score;
          const newPercentage = isScoreUpdatedByTeacher ? submission.percentage : existing.percentage;

          const { error: updateErr } = await supabase
            .from('submissions')
            .update({
              status: newStatus,
              teacher_feedback: newFeedback || null,
              score: newScore,
              percentage: newPercentage,
              synced_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateErr) {
            throw new Error(`Database error updating submission ${existing.id}: ${updateErr.message}`);
          }
          return {
            ...existing,
            status: newStatus,
            teacherFeedback: newFeedback,
            score: newScore,
            percentage: newPercentage,
          };
        }
        // Monotonic protection: preserve authoritative server state intact on duplicate retry
        return existing;
      }
    }

    // 2. Insert main submission record
    const { error: subError } = await supabase.from('submissions').insert({
      id: subId,
      quiz_id: quizId,
      learner_id: learnerId,
      score: submission.score,
      total_marks: submission.totalMarks,
      percentage: submission.percentage,
      status: submission.status,
      sync_status: submission.syncStatus,
      is_offline_submission: submission.isOfflineSubmission,
      client_submission_hash: submission.clientSubmissionHash,
      submitted_at: submission.submittedAt || new Date().toISOString(),
      synced_at: submission.syncedAt || new Date().toISOString(),
      teacher_feedback: submission.teacherFeedback || null,
      topics_to_practise: submission.topicsToPractise || [],
    });

    if (subError) {
      // If error is duplicate key on client_submission_hash, retrieve and return existing
      if (
        (subError as any).code === '23505' ||
        subError.message.includes('unique constraint') ||
        subError.message.includes('duplicate key') ||
        subError.message.includes('client_submission_hash')
      ) {
        const existing = await this.getSubmissionByHash(submission.clientSubmissionHash);
        if (existing) return existing;
      }
      throw new Error(`Database error saving submission: ${subError.message}`);
    }

    // 3. Insert question answers into submission_answers
    if (submission.answers && Object.keys(submission.answers).length > 0) {
      const answerInserts = Object.entries(submission.answers).map(([qId, response]) => ({
        id: deterministicUUID(`${subId}_${qId}`),
        submission_id: subId,
        question_id: resolveUUID(qId),
        response: String(response),
        is_correct: submission.answerDetails?.find((d) => d.questionId === qId)?.isCorrect ?? null,
        marks_awarded: submission.answerDetails?.find((d) => d.questionId === qId)?.marksAwarded ?? 0,
      }));

      const { error: ansError } = await supabase
        .from('submission_answers')
        .upsert(answerInserts, { onConflict: 'submission_id,question_id' });

      if (ansError) {
        throw new Error(`Database error saving submission answers: ${ansError.message}`);
      }
    }

    const saved = await this.getSubmissionById(subId);
    return saved || submission;
  }

  public async updateSubmissionFeedback(
    submissionId: string,
    teacherFeedback?: string,
    adjustedScore?: number
  ): Promise<Submission> {
    this.assertPersistence();

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase client is not available in production mode.');
    }

    const resolvedSubId = resolveUUID(submissionId);
    const sub = await this.getSubmissionById(resolvedSubId);
    if (!sub) throw new Error('Submission not found.');

    const updatePayload: Record<string, any> = {};
    if (teacherFeedback !== undefined) {
      updatePayload.teacher_feedback = teacherFeedback.trim();
    }
    if (adjustedScore !== undefined) {
      updatePayload.score = adjustedScore;
      updatePayload.percentage = sub.totalMarks > 0 ? Math.round((adjustedScore / sub.totalMarks) * 100) : 0;
    }

    const { error } = await supabase.from('submissions').update(updatePayload).eq('id', resolvedSubId);
    if (error) {
      throw new Error(`Database error updating feedback for submission ${submissionId}: ${error.message}`);
    }

    const updated = await this.getSubmissionById(resolvedSubId);
    return updated!;
  }

  // Helper to map DB row to Submission model
  private mapSubmissionRowToModel(r: any): Submission {
    const answersMap: Record<string, string> = {};
    const answerDetails: AnswerRecord[] = [];

    (r.submission_answers || []).forEach((sa: any) => {
      answersMap[sa.question_id] = sa.response;
      answerDetails.push({
        questionId: sa.question_id,
        response: sa.response,
        isCorrect: sa.is_correct,
        marksAwarded: sa.marks_awarded,
      });
    });

    const studentName = r.learners
      ? `${r.learners.first_name || ''} ${r.learners.last_name || ''}`.trim()
      : 'Student';

    return {
      id: r.id,
      quizId: r.quiz_id,
      quizTitle: r.quizzes?.title || 'Assessment',
      subjectName: r.quizzes?.subjects?.name || 'General',
      learnerId: r.learner_id,
      learnerName: studentName,
      classId: r.learners?.class_memberships?.[0]?.classes?.id || 'cls-3a',
      className: r.learners?.class_memberships?.[0]?.classes?.name || 'Grade 3A',
      answers: answersMap,
      answerDetails,
      score: r.score,
      totalMarks: r.total_marks,
      percentage: r.percentage,
      status: r.status,
      syncStatus: r.sync_status,
      isOfflineSubmission: r.is_offline_submission,
      submittedAt: r.submitted_at,
      syncedAt: r.synced_at,
      teacherFeedback: r.teacher_feedback || undefined,
      topicsToPractise: r.topics_to_practise || [],
      clientSubmissionHash: r.client_submission_hash,
    };
  }
}

export const databaseAdapter = new DatabaseAdapter();
