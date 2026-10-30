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

  // 10. Submit Attempt
  async submitQuiz(
    quizId: string,
    answers: Record<string, string>,
    clientSubmissionHash?: string,
    isOffline = false
  ): Promise<Submission> {
    const token = authService.getAuthToken();
    const res = await fetch('/api/submissions', {
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
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Assessment submission rejected by server.');
    }
    if (data.submission) {
      appDataStore.saveSubmission(data.submission);
      return data.submission;
    }
    throw new Error('Invalid response from server.');
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
      return appDataStore.getSubmissionsByLearner(user.learnerId);
    }
    return [];
  },
};
