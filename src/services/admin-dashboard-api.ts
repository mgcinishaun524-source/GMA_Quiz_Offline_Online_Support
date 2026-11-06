import { authService } from './auth-service';
import { networkManager } from '../lib/network';

export interface AdminDashboardOverview {
  generatedAt: string;
  school: {
    name: string;
    academicYear: string;
    currentTerm: string;
    termEndDate: string | null;
    passMark: number;
  };
  metrics: {
    learnersTotal: number;
    learnersActive: number;
    teachersTotal: number;
    teachersActive: number;
    classesTotal: number;
    quizzesTotal: number;
    quizzesOpen: number;
    quizzesDraft: number;
    quizzesClosed: number;
    submissionsTotal: number;
    offlineSubmissions: number;
    pendingServerSync: number;
  };
  devices: {
    available: boolean;
    onlineLearnerTablets: number | null;
    onlineWindowSeconds: number;
    message?: string;
  };
  recentQuizzes: Array<{
    id: string;
    title: string;
    status: string;
    className: string;
    subjectName: string;
    allowOffline: boolean;
    authorName: string;
    createdAt: string | null;
  }>;
}

const DEVICE_ID_STORAGE_KEY = 'GMA_DEVICE_PRESENCE_ID';
const HEARTBEAT_INTERVAL_MS = 30_000;

export async function fetchAdminDashboardOverview(): Promise<AdminDashboardOverview> {
  const token = authService.getAuthToken();
  const response = await fetch('/api/admin/dashboard', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Dashboard data unavailable (HTTP ${response.status}).`);
  }

  return data as AdminDashboardOverview;
}

function getDeviceId(): string | null {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }

    const id = globalThis.crypto?.randomUUID?.();
    if (!id) return null;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function startDeviceHeartbeat(): () => void {
  if (typeof window === 'undefined') return () => {};

  const deviceId = getDeviceId();
  if (!deviceId) return () => {};

  const sendHeartbeat = async () => {
    const token = authService.getAuthToken();
    if (!token || !networkManager.isOnline() || document.visibilityState === 'hidden') return;

    try {
      await fetch('/api/devices/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deviceId }),
        keepalive: true,
      });
    } catch {
      // Presence is best-effort; it must not interrupt the learner experience.
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void sendHeartbeat();
  };

  void sendHeartbeat();
  const interval = window.setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
  window.addEventListener('online', sendHeartbeat);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener('online', sendHeartbeat);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
