import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AppShell } from '../components/layout/AppShell';

// Auth pages stay in the entry bundle: they are the first screen an
// unauthenticated visitor sees, so code-splitting them would only add a
// round-trip before the login form can paint.
import { LoginPage } from '../features/auth/LoginPage';
import { UnauthorizedPage } from '../features/auth/UnauthorizedPage';

/**
 * Portal pages are code-split. Recharts and the quiz wizard made up most of the
 * old ~1 MB entry chunk, yet a learner sitting a quiz never opens analytics and
 * has no use for the admin console.
 *
 * These use `React.lazy` rather than the router's `lazy` route property so the
 * Suspense boundary can sit *inside* AppShell: the navigation chrome stays on
 * screen and only the content area shows a loader, instead of the whole app
 * blanking while the chunk is fetched.
 */
const AdminDashboard = React.lazy(() => import('../features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminLearnersPage = React.lazy(() => import('../features/admin/AdminLearnersPage').then((m) => ({ default: m.AdminLearnersPage })));
const AdminTeachersPage = React.lazy(() => import('../features/admin/AdminTeachersPage').then((m) => ({ default: m.AdminTeachersPage })));
const AdminClassesPage = React.lazy(() => import('../features/admin/AdminClassesPage').then((m) => ({ default: m.AdminClassesPage })));
const AdminSubjectsPage = React.lazy(() => import('../features/admin/AdminSubjectsPage').then((m) => ({ default: m.AdminSubjectsPage })));
const AdminAnalyticsPage = React.lazy(() => import('../features/admin/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminSettingsPage = React.lazy(() => import('../features/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));

const TeacherDashboard = React.lazy(() => import('../features/teacher/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })));
const TeacherClassesPage = React.lazy(() => import('../features/teacher/TeacherClassesPage').then((m) => ({ default: m.TeacherClassesPage })));
const TeacherQuizzesPage = React.lazy(() => import('../features/teacher/TeacherQuizzesPage').then((m) => ({ default: m.TeacherQuizzesPage })));
const NewQuizPage = React.lazy(() => import('../features/teacher/QuizWizard/NewQuizPage').then((m) => ({ default: m.NewQuizPage })));
const TeacherQuizDetailPage = React.lazy(() => import('../features/teacher/TeacherQuizDetailPage').then((m) => ({ default: m.TeacherQuizDetailPage })));
const TeacherSubmissionsPage = React.lazy(() => import('../features/teacher/TeacherSubmissionsPage').then((m) => ({ default: m.TeacherSubmissionsPage })));
const TeacherResultsPage = React.lazy(() => import('../features/teacher/TeacherResultsPage').then((m) => ({ default: m.TeacherResultsPage })));
const TeacherAnalyticsPage = React.lazy(() => import('../features/teacher/TeacherAnalyticsPage').then((m) => ({ default: m.TeacherAnalyticsPage })));
const TeacherSettingsPage = React.lazy(() => import('../features/teacher/TeacherSettingsPage').then((m) => ({ default: m.TeacherSettingsPage })));

const LearnerDashboard = React.lazy(() => import('../features/learner/LearnerDashboard').then((m) => ({ default: m.LearnerDashboard })));
const LearnerQuizzesPage = React.lazy(() => import('../features/learner/LearnerQuizzesPage').then((m) => ({ default: m.LearnerQuizzesPage })));
const LearnerQuizPlayer = React.lazy(() => import('../features/learner/LearnerQuizPlayer').then((m) => ({ default: m.LearnerQuizPlayer })));
const LearnerSubmittedPage = React.lazy(() => import('../features/learner/LearnerSubmittedPage').then((m) => ({ default: m.LearnerSubmittedPage })));
const LearnerResultsPage = React.lazy(() => import('../features/learner/LearnerResultsPage').then((m) => ({ default: m.LearnerResultsPage })));

// Shared by the teacher and learner portals, so it is declared once and both
// routes resolve to the same chunk.
const PrintableQuizPage = React.lazy(() => import('../features/teacher/PrintableQuizPage').then((m) => ({ default: m.PrintableQuizPage })));

/** Shown in the content area while a page chunk is fetching. */
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
    <span className="sr-only">Loading page…</span>
    <span
      aria-hidden="true"
      className="h-7 w-7 rounded-full border-2 border-[#0B1F4B]/15 border-t-[#0B1F4B] animate-spin"
    />
  </div>
);

type PageComponent = React.LazyExoticComponent<React.ComponentType>;

const page = (Component: PageComponent) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

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
          { path: 'dashboard', element: page(AdminDashboard) },
          { path: 'learners', element: page(AdminLearnersPage) },
          { path: 'teachers', element: page(AdminTeachersPage) },
          { path: 'classes', element: page(AdminClassesPage) },
          { path: 'subjects', element: page(AdminSubjectsPage) },
          { path: 'analytics', element: page(AdminAnalyticsPage) },
          { path: 'settings', element: page(AdminSettingsPage) },
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
          { path: 'dashboard', element: page(TeacherDashboard) },
          { path: 'classes', element: page(TeacherClassesPage) },
          { path: 'quizzes', element: page(TeacherQuizzesPage) },
          { path: 'quizzes/new', element: page(NewQuizPage) },
          { path: 'quizzes/:id', element: page(TeacherQuizDetailPage) },
          { path: 'quizzes/:id/print', element: page(PrintableQuizPage) },
          { path: 'submissions', element: page(TeacherSubmissionsPage) },
          { path: 'results', element: page(TeacherResultsPage) },
          { path: 'analytics', element: page(TeacherAnalyticsPage) },
          { path: 'settings', element: page(TeacherSettingsPage) },
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
          { path: 'dashboard', element: page(LearnerDashboard) },
          { path: 'quizzes', element: page(LearnerQuizzesPage) },
          { path: 'quizzes/:id/print', element: page(PrintableQuizPage) },
          { path: 'take/:id', element: page(LearnerQuizPlayer) },
          { path: 'submitted', element: page(LearnerSubmittedPage) },
          { path: 'results', element: page(LearnerResultsPage) },
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
