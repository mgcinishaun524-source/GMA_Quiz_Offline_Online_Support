// Sync Queue Manager for Offline Submissions
// Handles retry logic, idempotent IDs, conflict handling and visible sync state

import {
  getQueuedSubmissions,
  updateQueueItemStatus,
  removeQueueItem,
  QueuedSubmissionItem,
} from './offline-db';
import { networkManager } from './network';
import { appDataStore } from '../services/storage';

export interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  lastError: string | null;
  items: QueuedSubmissionItem[];
}

type SyncListener = (state: SyncState) => void;

class SyncQueueService {
  private isSyncing = false;
  private lastSyncTime: string | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private itemsCache: QueuedSubmissionItem[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // Refresh items on load
      this.refreshQueue();

      // Listen for network reconnect
      networkManager.subscribe((isOnline) => {
        if (isOnline) {
          this.processQueue();
        }
      });

      // Periodic check every 25 seconds
      setInterval(() => {
        if (networkManager.isOnline() && !this.isSyncing) {
          this.processQueue();
        }
      }, 25000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): SyncState {
    return {
      isSyncing: this.isSyncing,
      pendingCount: this.itemsCache.filter((i) => i.status !== 'synced').length,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      items: [...this.itemsCache],
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  public async refreshQueue(): Promise<QueuedSubmissionItem[]> {
    try {
      this.itemsCache = await getQueuedSubmissions();
      this.notify();
      return this.itemsCache;
    } catch {
      return [];
    }
  }

  public async processQueue(): Promise<{ processed: number; errors: number }> {
    if (!networkManager.isOnline()) {
      return { processed: 0, errors: 0 };
    }

    if (this.isSyncing) {
      return { processed: 0, errors: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    await this.refreshQueue();
    const pendingItems = this.itemsCache.filter((item) => item.status !== 'synced');

    let processed = 0;
    let errors = 0;

    for (const item of pendingItems) {
      try {
        await updateQueueItemStatus(item.id, 'syncing');
        this.notify();

        // Transmit to server sync endpoint
        const token = localStorage.getItem('GMA_AUTH_TOKEN');
        const resp = await fetch('/api/submissions/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            items: [
              {
                id: item.id,
                submission: item.submission,
                clientSubmissionHash: item.submission.clientSubmissionHash,
              },
            ],
          }),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          throw new Error(errBody.error || `Server sync failed with HTTP status ${resp.status}`);
        }

        const data = await resp.json();
        const itemResult = data.results?.[0];
        if (itemResult && itemResult.status === 'rejected') {
          throw new Error(itemResult.reason || 'Server rejected queued submission');
        }

        // Sync with central store upon verified server recording:
        const updatedSubmission = {
          ...item.submission,
          status: 'marked' as const,
          syncStatus: 'synced' as const,
          syncedAt: new Date().toISOString(),
          isOfflineSubmission: true,
        };

        // Persist to central client/server store
        appDataStore.saveSubmission(updatedSubmission);

        // Mark as synced in local queue and clean up from IndexedDB
        await updateQueueItemStatus(item.id, 'synced');
        await removeQueueItem(item.id);
        processed++;
      } catch (err: unknown) {
        errors++;
        const errMsg = err instanceof Error ? err.message : 'Network sync failed';
        this.lastError = errMsg;
        await updateQueueItemStatus(item.id, 'failed', errMsg);
      }
    }

    this.isSyncing = false;
    this.lastSyncTime = new Date().toISOString();
    await this.refreshQueue();
    this.notify();

    return { processed, errors };
  }

  public async retryItem(id: string): Promise<void> {
    if (!networkManager.isOnline()) {
      this.lastError = 'Cannot sync while offline. Reconnect or disable offline simulation.';
      this.notify();
      return;
    }
    await this.processQueue();
  }
}

export const syncQueueService = new SyncQueueService();
