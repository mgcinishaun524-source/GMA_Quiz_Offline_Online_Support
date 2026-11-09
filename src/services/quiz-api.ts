// Quiz & Submission API Service
// Connects UI workflows to the Express backend. Quiz lifecycle writes are
// server-authoritative: a quiz is only reported as created/updated/published once
// the backend has persisted it. Reads fall back to the last confirmed local cache
// when the server is unreachable, which is what powers offline learner access.

import { Quiz } from '../types/quiz';
import { Submission } from '../types/submission';
import { authService } from './auth-service';
import { appDataStore } from './storage';

function getAuthHeader(): Record<string, string> {
  const token = authService.getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// A learner submission must never be able to hang indefinitely. Without an
// explicit deadline a fetch can stay pending forever on a flaky school network
// (or behind a captive portal), which is what made the submit button appear to
// freeze. On expiry the AbortController rejects the promise, so the caller can
// fall back to the durable offline queue instead of waiting.
const SUBMIT_TIMEOUT_MS = 20_000;

// Thrown when the server answered and refused the attempt (deadline passed,
// attempt limit reached, wrong class, …). This is a real result that must be
// shown to the learner — it must never be silently re-queued offline, which
// would make a rejected submission look successful.
export class SubmissionRejectedError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SubmissionRejectedError';
    this.status = status;
  }
}

// The server-owned timed sitting of an assessment. `deadlineAt` is the single
// authority for the hard duration cutoff; it is computed on the server and the
// client only ever displays it.
export interface TimedAttempt {
  quizId: string;
  startedAt: string;
  deadlineAt: string;
  status: 'in_progress' | 'submitted' | 'terminated';
}

export interface StartAttemptResult {
  attempt: TimedAttempt;
  durationMinutes: number;
  serverTime: string;
}

export const quizApiService = {
  // --- TEACHER QUIZ LIFECYCLE ---

  // 1. Create Quiz (Draft or Published)
  async createQuiz(quizData: Partial<Quiz>): Promise<Quiz> {
    const res = await fetch('/api/quizzes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(quizData),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.quiz) {
        appDataStore.saveQuiz(data.quiz);
        return data.quiz;
      }
      throw new Error('Invalid response from server.');
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create quiz on server.');
  },

  // 2. Update Quiz (Drafts edit freely; locked if submissions exist)
  async updateQuiz(id: string, updates: Partial<Quiz>): Promise<Quiz> {
    const res = await fetch(`/api/quizzes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.quiz) {
        appDataStore.saveQuiz(data.quiz);
        return data.quiz;
      }
      throw new Error('Invalid response from server.');
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update quiz on server.');
  },

  // 3. Publish Quiz
  async publishQuiz(id: string): Promise<Quiz> {
    const res = await fetch(`/api/quizzes/${id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.quiz) {
        appDataStore.saveQuiz(data.quiz);
        return data.quiz;
      }
      throw new Error('Invalid response from server.');
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to publish assessment.');
  },

  // 3b. Close Quiz (server-authoritative — stops new learner attempts school-wide)
  async closeQuiz(id: string): Promise<Quiz> {
    const res = await fetch(`/api/quizzes/${id}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.quiz) {
        appDataStore.saveQuiz(data.quiz);
        return data.quiz;
      }
      throw new Error('Invalid response from server.');
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to close assessment.');
  },

  // 4. Assign Quiz to Class
  async assignQuiz(id: string, classId: string, className?: string): Promise<Quiz> {
    const res = await fetch(`/api/quizzes/${id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ classId, className }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.quiz) {
        appDataStore.saveQuiz(data.quiz);
        return data.quiz;
      }
      throw new Error('Invalid response from server.');
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to assign quiz.');
  },

  // 5. Delete Quiz
  async deleteQuiz(id: string): Promise<boolean> {
    const res = await fetch(`/api/quizzes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete assessment.');
    }

    // Remove the confirmed-deleted quiz from the local cache as well.
    const remaining = appDataStore.getQuizzes().filter((q) => q.id !== id);
    localStorage.setItem('GMA_STORE_QUIZZES', JSON.stringify(remaining));
    return true;
  },

  // 6. Release Results
  async releaseResults(id: string): Promise<Quiz> {
    const res = await fetch(`/api/quizzes/${id}/release-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.quiz) {
        appDataStore.updateQuizStatus(id, 'results_released');
        return data.quiz;
      }
      throw new Error('Invalid response from server.');
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to release results.');
  },

  // 7. Fetch Submissions for a Quiz
  async fetchQuizSubmissions(quizId: string): Promise<Submission[]> {
    try {
      const res = await fetch(`/api/quizzes/${quizId}/submissions`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.submissions || [];
      }
    } catch {
      // Fallback to local store
    }
    return appDataStore.getSubmissionsByQuiz(quizId);
  },

  // 8. Teacher Feedback / Marks Adjustment
  async recordTeacherFeedback(
    submissionId: string,
    feedback: string,
    adjustedScore?: number
  ): Promise<Submission> {
    const res = await fetch(`/api/submissions/${submissionId}/feedback`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ teacherFeedback: feedback, adjustedScore }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.submission) {
        appDataStore.saveSubmission(data.submission);
        return data.submission;
      }
      throw new Error('Invalid response from server.');
    }

    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to record feedback.');
  },

  // --- LEARNER WORKFLOWS ---

  // 9. Fetch Available Quizzes for Learner
  async fetchLearnerQuizzes(): Promise<Quiz[]> {
    try {
      const res = await fetch('/api/quizzes', {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.quizzes || [];
      }
    } catch {
      // Fallback to local store
    }
    return appDataStore.getQuizzes();
  },

  // 9b. Start (or resume) the server-owned clock for a timed assessment.
  //     Reopening returns the SAME deadline, so refreshing the page or opening
  //     a second tab cannot buy extra time. Refuses to start when the server
  //     cannot own the clock, rather than handing out an unenforceable timer.
  async startTimedAttempt(quizId: string): Promise<StartAttemptResult> {
    const res = await fetch(`/api/quizzes/${quizId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });

    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      throw new SubmissionRejectedError(
        (data as { error?: string }).error || 'Unable to start this timed assessment.',
        res.status
      );
    }

    const result = data as unknown as StartAttemptResult;
    if (!result?.attempt?.deadlineAt) {
      throw new Error('Invalid response from server.');
    }
    return result;
  },

  // 10. Submit Attempt
  async submitQuiz(
    quizId: string,
    answers: Record<string, string>,
    clientSubmissionHash?: string,
    isOffline = false,
    integrityReason?: string
  ): Promise<Submission> {
    const token = authService.getAuthToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          quizId,
          answers,
          clientSubmissionHash,
          isOfflineSubmission: isOffline,
          submittedAt: new Date().toISOString(),
          ...(integrityReason ? { integrityReason } : {}),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // A gateway/proxy failure can return HTML rather than JSON, so parse
    // defensively instead of letting res.json() throw a confusing SyntaxError.
    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      throw new SubmissionRejectedError(
        (data as { error?: string }).error || 'Assessment submission rejected by server.',
        res.status
      );
    }
    if (data.submission) {
      appDataStore.saveSubmission(data.submission as Submission);
      return data.submission as Submission;
    }
    throw new SubmissionRejectedError('Invalid response from server.', res.status);
  },

  // 12. Fetch All Submissions for Teacher (bulk — fetches per quiz in parallel)
  async fetchAllTeacherSubmissions(): Promise<void> {
    try {
      const quizzes = appDataStore.getQuizzes();
      if (quizzes.length === 0) return;
      const chunkSize = 5;
      for (let i = 0; i < quizzes.length; i += chunkSize) {
        const chunk = quizzes.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (quiz) => {
            try {
              const subs = await quizApiService.fetchQuizSubmissions(quiz.id);
              subs.forEach((s) => appDataStore.saveSubmission(s));
            } catch {
              // non-fatal
            }
          })
        );
      }
    } catch {
      // non-fatal
    }
  },

  // 11. Fetch Learner Results
  async fetchLearnerResults(): Promise<Submission[]> {
    try {
      const res = await fetch('/api/learners/results', {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.submissions || [];
      }
    } catch {
      // Fallback
    }
    const user = authService.getCurrentUser();
    if (user?.learnerId) {
      return appDataStore.getSubmissionsByLearner(user.learnerId, user.id);
    }
    return [];
  },
};
