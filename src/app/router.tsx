import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AppShell } from '../components/layout/AppShell';

// Auth Pages
import { LoginPage } from '../features/auth/LoginPage';
import { UnauthorizedPage } from '../features/auth/UnauthorizedPage';

// Admin Pages
import { AdminDashboard } from '../features/admin/AdminDashboard';
import { AdminLearnersPage } from '../features/admin/AdminLearnersPage';
import { AdminTeachersPage } from '../features/admin/AdminTeachersPage';
import { AdminClassesPage } from '../features/admin/AdminClassesPage';
import { AdminSubjectsPage } from '../features/admin/AdminSubjectsPage';
import { AdminAnalyticsPage } from '../features/admin/AdminAnalyticsPage';
import { AdminSettingsPage } from '../features/admin/AdminSettingsPage';

// Teacher Pages
import { TeacherDashboard } from '../features/teacher/TeacherDashboard';
import { TeacherClassesPage } from '../features/teacher/TeacherClassesPage';
import { TeacherQuizzesPage } from '../features/teacher/TeacherQuizzesPage';
import { NewQuizPage } from '../features/teacher/QuizWizard/NewQuizPage';
import { TeacherQuizDetailPage } from '../features/teacher/TeacherQuizDetailPage';
import { TeacherSubmissionsPage } from '../features/teacher/TeacherSubmissionsPage';
import { TeacherResultsPage } from '../features/teacher/TeacherResultsPage';
import { TeacherAnalyticsPage } from '../features/teacher/TeacherAnalyticsPage';
import { TeacherSettingsPage } from '../features/teacher/TeacherSettingsPage';
import { PrintableQuizPage } from '../features/teacher/PrintableQuizPage';

// Learner Pages
import { LearnerDashboard } from '../features/learner/LearnerDashboard';
import { LearnerQuizzesPage } from '../features/learner/LearnerQuizzesPage';
import { LearnerQuizPlayer } from '../features/learner/LearnerQuizPlayer';
import { LearnerSubmittedPage } from '../features/learner/LearnerSubmittedPage';
import { LearnerResultsPage } from '../features/learner/LearnerResultsPage';

// Route Guard Component
interface ProtectedRouteProps {
  allowedRoles: ('admin' | 'teacher' | 'learner')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, role, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

// Root Redirect Component
const RootRedirect: React.FC = () => {
  const { user, role, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
  if (role === 'learner') return <Navigate to="/learner/dashboard" replace />;

  return <Navigate to="/login" replace />;
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },

  // Admin Portal Base
  {
    path: '/admin',
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboard /> },
          { path: 'learners', element: <AdminLearnersPage /> },
          { path: 'teachers', element: <AdminTeachersPage /> },
          { path: 'classes', element: <AdminClassesPage /> },
          { path: 'subjects', element: <AdminSubjectsPage /> },
          { path: 'analytics', element: <AdminAnalyticsPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
        ],
      },
    ],
  },

  // Teacher Portal Base
  {
    path: '/teacher',
    element: <ProtectedRoute allowedRoles={['teacher', 'admin']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
          { path: 'dashboard', element: <TeacherDashboard /> },
          { path: 'classes', element: <TeacherClassesPage /> },
          { path: 'quizzes', element: <TeacherQuizzesPage /> },
          { path: 'quizzes/new', element: <NewQuizPage /> },
          { path: 'quizzes/:id', element: <TeacherQuizDetailPage /> },
          { path: 'quizzes/:id/print', element: <PrintableQuizPage /> },
          { path: 'submissions', element: <TeacherSubmissionsPage /> },
          { path: 'results', element: <TeacherResultsPage /> },
          { path: 'analytics', element: <TeacherAnalyticsPage /> },
          { path: 'settings', element: <TeacherSettingsPage /> },
        ],
      },
    ],
  },

  // Learner Portal Base
  {
    path: '/learner',
    element: <ProtectedRoute allowedRoles={['learner', 'teacher', 'admin']} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/learner/dashboard" replace /> },
          { path: 'dashboard', element: <LearnerDashboard /> },
          { path: 'quizzes', element: <LearnerQuizzesPage /> },
          { path: 'quizzes/:id/print', element: <PrintableQuizPage /> },
          { path: 'take/:id', element: <LearnerQuizPlayer /> },
          { path: 'submitted', element: <LearnerSubmittedPage /> },
          { path: 'results', element: <LearnerResultsPage /> },
        ],
      },
    ],
  },

  // Catch-all 404
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
