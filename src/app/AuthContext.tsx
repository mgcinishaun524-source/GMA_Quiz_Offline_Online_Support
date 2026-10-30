import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types/auth';
import { authService } from '../services/auth-service';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loginStaff: (email: string, pass: string) => Promise<UserProfile>;
  loginLearner: (id: string, pin: string) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(authService.getCurrentUser());

  useEffect(() => {
    return authService.subscribe((newUser) => {
      setUser(newUser);
    });
  }, []);

  const loginStaff = async (email: string, pass: string) => {
    return authService.loginStaff(email, pass);
  };

  const loginLearner = async (id: string, pin: string) => {
    return authService.loginLearner(id, pin);
  };

  const logout = () => {
    authService.logout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: !!user,
        loginStaff,
        loginLearner,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
