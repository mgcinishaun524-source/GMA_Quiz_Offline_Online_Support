import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { directoryApiService } from '../../services/directory-api';
import { NetworkSimulatorBar } from '../feedback/NetworkSimulatorBar';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  BarChart3,
  Settings,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

export const AppShell: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Runtime mode is reported by the backend (/api/health authMode) so the footer
  // reflects actual authentication readiness rather than the build-time VITE_APP_MODE
  // flag alone.
  const [authMode, setAuthMode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.authMode === 'string') {
          setAuthMode(data.authMode);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthMode(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate the academic directory (subjects, classes, faculty) from the server for
  // staff portals so every record created in Supabase is available across screens.
  useEffect(() => {
    if (role === 'admin' || role === 'teacher') {
      void directoryApiService.hydrateDirectory();
    }
  }, [role]);

  const runtimeModeLabel =
    authMode === 'supabase'
      ? 'Production Auth (Supabase Verified)'
      : authMode === 'strict-production'
      ? 'Production Mode (Database Required)'
      : 'Runtime Mode Unknown';

  const adminNavItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/learners', label: 'Learners', icon: Users },
    { to: '/admin/teachers', label: 'Teachers', icon: GraduationCap },
    { to: '/admin/classes', label: 'Classes', icon: Layers },
    { to: '/admin/subjects', label: 'Subjects', icon: BookOpen },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const teacherNavItems = [
    { to: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/teacher/quizzes', label: 'Quizzes', icon: HelpCircle },
    { to: '/teacher/classes', label: 'Classes', icon: Layers },
    { to: '/teacher/submissions', label: 'Submissions', icon: FileCheck },
    { to: '/teacher/results', label: 'Results', icon: CheckCircle2 },
    { to: '/teacher/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/teacher/settings', label: 'Settings', icon: Settings },
  ];

  const learnerNavItems = [
    { to: '/learner/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { to: '/learner/quizzes', label: 'My Quizzes', icon: HelpCircle },
    { to: '/learner/results', label: 'My Results', icon: CheckCircle2 },
  ];

  const navItems =
    role === 'admin'
      ? adminNavItems
      : role === 'teacher'
      ? teacherNavItems
      : learnerNavItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col font-sans">
      {/* Top Network & Offline Simulation Bar */}
      <NetworkSimulatorBar />

      {/* Main Header */}
      <header className="bg-[#1C2C5B] text-white border-b border-[#6CABDD]/30 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Wordmark */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1C2C5B] border-2 border-[#6CABDD] flex items-center justify-center shrink-0">
                <span className="font-bold text-sm tracking-wider text-[#6CABDD]">GMA</span>
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-white block uppercase">
                  Growing Minds Academy
                </span>
                <span className="text-[11px] font-medium text-[#6CABDD] tracking-wider block">
                  AI QUIZ & LEARNING ANALYTICS
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors border ${
                        isActive
                          ? 'bg-[#6CABDD] text-[#1C2C5B] border-[#6CABDD]'
                          : 'text-slate-200 border-transparent hover:text-white hover:bg-white/10'
                      }`
                    }
                  >
                    <Icon size={14} className="shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Right Side: Role Badge & User Avatar */}
            <div className="flex items-center gap-3">
              {/* Verified Static Role Badge */}
              <div className="flex items-center gap-2 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-[#0F172A] border border-[#6CABDD]/50 text-[#E8F3FC]">
                <span className="w-2 h-2 bg-[#6CABDD]" />
                <span>Role: {role?.toUpperCase()}</span>
              </div>

              {/* User info & Logout */}
              <div className="hidden sm:flex items-center gap-2 border-l border-white/20 pl-3">
                <div className="w-8 h-8 bg-[#6CABDD] text-[#1C2C5B] font-bold text-xs flex items-center justify-center shrink-0">
                  {user?.avatarInitial || 'GM'}
                </div>
                <div className="text-left hidden lg:block">
                  <span className="text-xs font-semibold text-white block leading-tight">
                    {user?.name || 'Authorized User'}
                  </span>
                  <span className="text-[10px] text-slate-300 block">
                    {user?.className || user?.email || 'School Access'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>

              {/* Mobile menu trigger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-white hover:bg-white/10"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#1C2C5B] border-t border-[#6CABDD]/20 px-4 pt-2 pb-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                      isActive ? 'bg-[#6CABDD] text-[#1C2C5B]' : 'text-slate-200 hover:bg-white/10'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span>Signed in as {user?.name}</span>
              <button onClick={handleLogout} className="text-[#6CABDD] underline cursor-pointer">
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#CBD5E1] py-4 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-[#1C2C5B]">Growing Minds Academy</span> — AI-Powered Quiz & Learning Analytics Platform
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Local Offline Persistence: IndexedDB</span>
            <span className="hidden sm:inline">|</span>
            <span>{runtimeModeLabel}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
