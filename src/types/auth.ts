// User and Authentication Types
export type UserRole = 'admin' | 'teacher' | 'learner';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  learnerId?: string;
  grade?: string;
  className?: string;
  assignedSubjects?: string[];
  assignedClasses?: string[];
  avatarInitial: string;
}

export interface AuthSession {
  user: UserProfile;
  token: string;
  isAuthenticated: boolean;
  loginAt: string;
}
