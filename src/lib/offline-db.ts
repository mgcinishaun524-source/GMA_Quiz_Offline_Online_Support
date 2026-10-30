// Offline IndexedDB Storage Layer for Growing Minds Academy
// Durable storage for offline quizzes, in-progress answers, and queued submissions

import { Quiz } from '../types/quiz';
import { Submission } from '../types/submission';

const DB_NAME = 'GMA_Offline_DB';
const DB_VERSION = 1;

export interface InProgressAnswers {
  key: string; // `${quizId}_${learnerId}`
  quizId: string;
  learnerId: string;
  answers: Record<string, string>;
  lastSavedAt: string;
  currentQuestionIndex: number;
}

export interface QueuedSubmissionItem {
  id: string; // idempotent submission uuid
  submission: Submission;
  queuedAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Quizzes cached for offline use
      if (!db.objectStoreNames.contains('cached_quizzes')) {
        db.createObjectStore('cached_quizzes', { keyPath: 'id' });
      }

      // 2. Realtime answers in progress per learner per quiz
      if (!db.objectStoreNames.contains('active_answers')) {
        db.createObjectStore('active_answers', { keyPath: 'key' });
      }

      // 3. Pending offline submissions queue
      if (!db.objectStoreNames.contains('submission_queue')) {
        db.createObjectStore('submission_queue', { keyPath: 'id' });
      }

      // 4. Offline sync logs
      if (!db.objectStoreNames.contains('sync_logs')) {
        db.createObjectStore('sync_logs', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ----------------- QUIZZES CACHE -----------------

export async function cacheQuizOffline(quiz: Quiz): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_quizzes', 'readwrite');
      const store = tx.objectStore('cached_quizzes');
      const req = store.put({ ...quiz, isCachedOffline: true, cachedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to cache quiz offline:', err);
  }
}

export async function removeCachedQuiz(quizId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_quizzes', 'readwrite');
      const store = tx.objectStore('cached_quizzes');
      const req = store.delete(quizId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to remove cached quiz:', err);
  }
}

export async function getCachedQuizzes(): Promise<Quiz[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_quizzes', 'readonly');
      const store = tx.objectStore('cached_quizzes');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to get cached quizzes:', err);
    return [];
  }
}

export async function getCachedQuizById(quizId: string): Promise<Quiz | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_quizzes', 'readonly');
      const store = tx.objectStore('cached_quizzes');
      const req = store.get(quizId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to get cached quiz by id:', err);
    return null;
  }
}

// ----------------- ACTIVE ANSWERS (IN-PROGRESS PERSISTENCE) -----------------

export async function saveActiveAnswers(
  quizId: string,
  learnerId: string,
  answers: Record<string, string>,
  currentQuestionIndex: number = 0
): Promise<void> {
  const key = `${quizId}_${learnerId}`;
  const data: InProgressAnswers = {
    key,
    quizId,
    learnerId,
    answers,
    currentQuestionIndex,
    lastSavedAt: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('active_answers', 'readwrite');
      const store = tx.objectStore('active_answers');
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to localStorage if IndexedDB fails
    localStorage.setItem(`GMA_DRAFT_${key}`, JSON.stringify(data));
  }
}

export async function getActiveAnswers(quizId: string, learnerId: string): Promise<InProgressAnswers | null> {
  const key = `${quizId}_${learnerId}`;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('active_answers', 'readonly');
      const store = tx.objectStore('active_answers');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          // Check fallback localStorage
          const local = localStorage.getItem(`GMA_DRAFT_${key}`);
          resolve(local ? JSON.parse(local) : null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const local = localStorage.getItem(`GMA_DRAFT_${key}`);
    return local ? JSON.parse(local) : null;
  }
}

export async function clearActiveAnswers(quizId: string, learnerId: string): Promise<void> {
  const key = `${quizId}_${learnerId}`;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('active_answers', 'readwrite');
      const store = tx.objectStore('active_answers');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
  localStorage.removeItem(`GMA_DRAFT_${key}`);
}

// ----------------- SUBMISSION QUEUE -----------------

export async function queueOfflineSubmission(submission: Submission): Promise<QueuedSubmissionItem> {
  const queueItem: QueuedSubmissionItem = {
    id: submission.id,
    submission,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('submission_queue', 'readwrite');
      const store = tx.objectStore('submission_queue');
      const req = store.put(queueItem);
      req.onsuccess = () => resolve(queueItem);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // LocalStorage fallback
    const queue = JSON.parse(localStorage.getItem('GMA_OFFLINE_QUEUE') || '[]');
    queue.push(queueItem);
    localStorage.setItem('GMA_OFFLINE_QUEUE', JSON.stringify(queue));
    return queueItem;
  }
}

export async function getQueuedSubmissions(): Promise<QueuedSubmissionItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('submission_queue', 'readonly');
      const store = tx.objectStore('submission_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const queue = JSON.parse(localStorage.getItem('GMA_OFFLINE_QUEUE') || '[]');
    return queue;
  }
}

export async function updateQueueItemStatus(
  id: string,
  status: 'pending' | 'syncing' | 'failed' | 'synced',
  error?: string
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction('submission_queue', 'readwrite');
    const store = tx.objectStore('submission_queue');
    const getReq = store.get(id);

    return new Promise((resolve, reject) => {
      getReq.onsuccess = () => {
        const item: QueuedSubmissionItem = getReq.result;
        if (!item) return resolve();
        item.status = status;
        item.lastAttemptAt = new Date().toISOString();
        if (error) item.lastError = error;
        if (status === 'failed') item.retryCount += 1;
        store.put(item).onsuccess = () => resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    // ignore
  }
}

export async function removeQueueItem(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('submission_queue', 'readwrite');
      const store = tx.objectStore('submission_queue');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}
