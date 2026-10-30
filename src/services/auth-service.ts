// Authentication Service Layer for Growing Minds Academy
// Real server-side JWT / Supabase auth + Strictly isolated offline policy.
// There is no demo/role-switch bypass: every session originates from a
// credential verification performed by the backend.

import { UserProfile } from '../types/auth';

const AUTH_STORAGE_KEY = 'GMA_AUTH_SESSION';
const AUTH_TOKEN_KEY = 'GMA_AUTH_TOKEN';

class AuthService {
  private currentUser: UserProfile | null = null;
  private currentToken: string | null = null;
  private listeners: Set<(user: UserProfile | null) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      this.currentToken = localStorage.getItem(AUTH_TOKEN_KEY);

      if (stored && this.currentToken) {
        try {
          this.currentUser = JSON.parse(stored);
        } catch {
          this.currentUser = null;
          this.currentToken = null;
        }
      } else {
        // Strict security: User starts unauthenticated without silent mock injection
        this.currentUser = null;
        this.currentToken = null;
      }
    }
  }

  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public getAuthToken(): string | null {
    return this.currentToken || (typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null);
  }

  public subscribe(fn: (user: UserProfile | null) => void): () => void {
    this.listeners.add(fn);
    fn(this.currentUser);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentUser));
  }

  // Teacher or Admin Login
  public async loginStaff(email: string, pass: string): Promise<UserProfile> {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      throw new Error('Please enter your school email address or username.');
    }
    if (!pass) {
      throw new Error('Please enter your password.');
    }

    const response = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: pass }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed. Please verify credentials.');
    }

    this.currentUser = data.user;
    this.currentToken = data.token;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
    if (this.currentToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, this.currentToken);
    }
    this.notify();
    return this.currentUser!;
  }

  // Learner Login via Student Number and 4-digit PIN
  public async loginLearner(learnerId: string, pin: string): Promise<UserProfile> {
    const cleanId = learnerId.trim().toUpperCase();
    const cleanPin = pin.trim();

    if (!cleanId) {
      throw new Error('Please enter your Student Number (e.g. GMA-2026-0301).');
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('PIN must consist of exactly 4 numeric digits.');
    }

    try {
      const response = await fetch('/api/auth/learner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentNumber: cleanId, pin: cleanPin }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      this.currentUser = data.user;
      this.currentToken = data.token;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
      if (this.currentToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, this.currentToken);
      }
      this.notify();
      return this.currentUser!;
    } catch (err: unknown) {
      // If error is an HTTP rejection (locked account, invalid PIN, 401, 429), rethrow immediately
      if (err instanceof Error && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
        throw err;
      }

      // Explicit previously-authenticated-device policy for offline learning:
      // If device already has an active, verified token for this student, preserve session
      const existingUser = this.getCurrentUser();
      const existingToken = this.getAuthToken();
      if (
        existingUser &&
        existingToken &&
        (existingUser.learnerId?.toUpperCase() === cleanId || existingUser.id?.toUpperCase() === cleanId)
      ) {
        this.notify();
        return existingUser;
      }

      throw new Error(
        'Offline Mode: No verified authentication session found on this device for this student. You must connect online to sign in once before accessing offline assessments.'
      );
    }
  }

  public logout(): void {
    this.currentUser = null;
    this.currentToken = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    this.notify();
  }
}

export const authService = new AuthService();
