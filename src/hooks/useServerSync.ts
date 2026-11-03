// useServerSync — fetches live data from Supabase on every mount and
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
          // Not logged in — nothing to fetch
          if (!cancelled) setState({ loading: false, error: null });
          return;
        }

        if (target === 'quizzes' || target === 'both') {
          const quizzes = await quizApiService.fetchLearnerQuizzes();
          if (!cancelled) {
            // Write all server quizzes into the local store, replacing stale data
            quizzes.forEach((q) => appDataStore.saveQuiz(q));
          }
        }

        if (target === 'results' || target === 'both') {
          const submissions = await quizApiService.fetchLearnerResults();
          if (!cancelled) {
            submissions.forEach((s) => appDataStore.saveSubmission(s));
          }
        }

        if (!cancelled) setState({ loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
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
