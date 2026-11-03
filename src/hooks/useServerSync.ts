// useServerSync — fetches live data from Supabase on every page mount and
// populates appDataStore so all components read fresh server data, not
// stale localStorage that only exists on the device it was first loaded on.
//
// This is the fix for the cross-device sync problem: without this, a learner
// logging in on a new device would see an empty quiz list because localStorage
// was never populated on that device.

import { useEffect, useState } from 'react';
import { quizApiService } from '../services/quiz-api';
import { appDataStore } from '../services/storage';
import { authService } from '../services/auth-service';

interface SyncState {
  loading: boolean;
  error: string | null;
}

type SyncTarget = 'quizzes' | 'results' | 'both';

/**
 * Fetches fresh data from the server on mount and writes it into appDataStore.
 * Components that already subscribe to appDataStore will re-render automatically.
 *
 * Role-aware:
 * - Learners  → GET /api/quizzes (class-filtered, answers stripped) +
 *               GET /api/learners/results (their own submissions)
 * - Teachers/Admins → GET /api/quizzes (all school quizzes) — results
 *               are fetched per-quiz by the specific pages that need them,
 *               not bulk-fetched here to avoid over-fetching.
 *
 * @param target  'quizzes' | 'results' | 'both'
 */
export function useServerSync(target: SyncTarget = 'quizzes'): SyncState {
  const [state, setState] = useState<SyncState>({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const token = authService.getAuthToken();
        if (!token) {
          if (!cancelled) setState({ loading: false, error: null });
          return;
        }

        const user = authService.getCurrentUser();
        const role = user?.role;

        // ── Quizzes ──────────────────────────────────────────────────────────
        // Works for all roles — server filters by role automatically.
        // Learners get class-eligible quizzes with answers stripped.
        // Teachers/admins get all school quizzes.
        if (target === 'quizzes' || target === 'both') {
          const quizzes = await quizApiService.fetchLearnerQuizzes();
          if (!cancelled) {
            quizzes.forEach((q) => appDataStore.saveQuiz(q));
          }
        }

        // ── Results / Submissions ────────────────────────────────────────────
        // Learners → GET /api/learners/results (their own submissions only).
        // Teachers/Admins → fetch submissions per quiz after quizzes are loaded.
        if (target === 'results' || target === 'both') {
          if (role === 'learner') {
            const submissions = await quizApiService.fetchLearnerResults();
            if (!cancelled) {
              submissions.forEach((s) => appDataStore.saveSubmission(s));
            }
          } else if (role === 'teacher' || role === 'admin') {
            // Fetch submissions per quiz — quizzes were already synced above
            await quizApiService.fetchAllTeacherSubmissions();
          }
        }

        if (!cancelled) setState({ loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            // Sync failures are non-fatal — the user still sees cached data
            error: err instanceof Error ? err.message : 'Failed to sync from server',
          });
        }
      }
    }

    sync();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount — components subscribe to appDataStore for live updates

  return state;
}
