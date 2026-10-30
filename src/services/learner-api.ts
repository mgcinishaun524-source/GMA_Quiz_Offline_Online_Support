// Learner Directory API Service
// Connects the admin learner directory to Express routes so enrollments persist
// to Supabase. Writes are server-authoritative: they only report success once the
// backend has confirmed the record. The local store is a read-only cache of
// previously confirmed records, never a source of fabricated learners.

import { Learner } from '../types/learner';
import { authService } from './auth-service';
import { appDataStore } from './storage';

export interface LearnerInput {
  firstName: string;
  lastName: string;
  grade: string;
  classId: string;
  className: string;
  pin: string;
  guardianContact?: string;
}

export interface LearnerUpdates extends Partial<LearnerInput> {
  isActive?: boolean;
}

function getAuthHeader(): Record<string, string> {
  const token = authService.getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- Raw server calls (throw on any failure, including network) ---

async function postLearner(input: LearnerInput): Promise<Learner> {
  const res = await fetch('/api/learners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(input),
  });

  if (res.ok) {
    const data = await res.json();
    if (data.learner) return data.learner as Learner;
    throw new Error('Invalid response from server.');
  }

  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || 'Failed to register the learner on the server.');
}

async function putLearner(id: string, updates: LearnerUpdates): Promise<Learner> {
  const res = await fetch(`/api/learners/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(updates),
  });

  if (res.ok) {
    const data = await res.json();
    if (data.learner) return data.learner as Learner;
    throw new Error('Invalid response from server.');
  }

  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || 'Failed to update the learner on the server.');
}

async function removeLearner(id: string): Promise<void> {
  const res = await fetch(`/api/learners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });

  if (res.ok) return;

  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || 'Failed to delete the learner on the server.');
}

// --- Public service ---

// Register a learner. Persistence is confirmed by the server before the UI is
// told the operation succeeded; failures surface an honest error.
async function createLearner(input: LearnerInput): Promise<Learner> {
  const created = await postLearner(input);
  appDataStore.upsertLearner(created);
  return created;
}

// Update a learner. Server-confirmed; no silent local-only mutation.
async function updateLearner(id: string, updates: LearnerUpdates): Promise<Learner> {
  const updated = await putLearner(id, updates);
  appDataStore.upsertLearner(updated);
  return updated;
}

// Delete a learner, surfacing server-side guards (e.g. linked submissions).
async function deleteLearner(id: string): Promise<boolean> {
  await removeLearner(id);
  appDataStore.deleteLearner(id);
  return true;
}

// Hydrate the directory from the server. The server response is authoritative.
// If the server is unreachable we return the last confirmed cache so an
// already-loaded screen does not blank out, but we never invent records.
async function fetchLearners(): Promise<Learner[]> {
  try {
    const res = await fetch('/api/learners', { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      const serverLearners: Learner[] = Array.isArray(data.learners) ? data.learners : [];
      appDataStore.setLearners(serverLearners);
      return appDataStore.getLearners();
    }
  } catch {
    // Fall back to the last confirmed cache below.
  }

  return appDataStore.getLearners();
}

export const learnerApiService = {
  fetchLearners,
  createLearner,
  updateLearner,
  deleteLearner,
};
