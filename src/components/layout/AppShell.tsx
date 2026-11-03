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
  const [authMode, setAuthMode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.authMode === 'string') setAuthMode(data.authMode);
      })
      .catch(() => { if (!cancelled) setAuthMode(null); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (role === 'admin' || role === 'teacher') {
      void directoryApiService.hydrateDirectory();
    }
  }, [role]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  const runtimeModeLabel =
    authMode === 'supabase' ? 'Production Auth (Supabase Verified)'
    : authMode === 'strict-production' ? 'Production Mode (Database Required)'
    : 'Runtime Mode Unknown';

  const adminNavItems = [
    { to: '/admin/dashboard',  label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/learners',   label: 'Learners',  icon: Users },
    { to: '/admin/teachers',   label: 'Teachers',  icon: GraduationCap },
    { to: '/admin/classes',    label: 'Classes',   icon: Layers },
    { to: '/admin/subjects',   label: 'Subjects',  icon: BookOpen },
    { to: '/admin/analytics',  label: 'Analytics', icon: BarChart3 },
    { to: '/admin/settings',   label: 'Settings',  icon: Settings },
  ];

  const teacherNavItems = [
    { to: '/teacher/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
    { to: '/teacher/quizzes',      label: 'Quizzes',     icon: HelpCircle },
    { to: '/teacher/classes',      label: 'Classes',     icon: Layers },
    { to: '/teacher/submissions',  label: 'Submissions', icon: FileCheck },
    { to: '/teacher/results',      label: 'Results',     icon: CheckCircle2 },
    { to: '/teacher/analytics',    label: 'Analytics',   icon: BarChart3 },
    { to: '/teacher/settings',     label: 'Settings',    icon: Settings },
  ];

  const learnerNavItems = [
    { to: '/learner/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { to: '/learner/quizzes',   label: 'My Quizzes',   icon: HelpCircle },
    { to: '/learner/results',   label: 'My Results',   icon: CheckCircle2 },
  ];

  const navItems =
    role === 'admin' ? adminNavItems
    : role === 'teacher' ? teacherNavItems
    : learnerNavItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] flex flex-col font-sans">
      <NetworkSimulatorBar />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-[#0B1F4B] text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Brand */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 border-2 border-[#D6A21E] flex items-center justify-center rounded-sm">
                <span className="font-extrabold text-xs tracking-widest text-[#D6A21E]">GMA</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-extrabold tracking-tight text-white block">
                  Growing Minds Academy
                </span>
                <span className="text-[10px] font-semibold text-[#D6A21E]/80 tracking-widest block uppercase">
                  AI Quiz & Analytics
                </span>
              </div>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center space-x-0.5 lg:space-x-1" aria-label="Main navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all duration-150 ${
                        isActive
                          ? 'text-[#D6A21E] bg-white/10 border-b-2 border-[#D6A21E]'
                          : 'text-slate-300 hover:text-white hover:bg-white/8'
                      }`
                    }
                  >
                    <Icon size={13} className="shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Role badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-[#D6A21E]/15 border border-[#D6A21E]/30 text-[#D6A21E] rounded-full">
                <span className="w-1.5 h-1.5 bg-[#D6A21E] rounded-full" />
                {role?.toUpperCase()}
              </div>

              {/* User info */}
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/15">
                <div className="w-8 h-8 bg-[#D6A21E] text-[#0B1F4B] font-bold text-xs flex items-center justify-center rounded-full shrink-0">
                  {user?.avatarInitial || 'GM'}
                </div>
                <div className="hidden lg:block text-left">
                  <span className="text-xs font-semibold text-white block leading-tight truncate max-w-[120px]">
                    {user?.name || 'Authorized User'}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">
                    {user?.className || user?.email || 'School Access'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-all duration-150 cursor-pointer"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </div>

              {/* Mobile menu trigger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-white hover:bg-white/10 rounded-md transition-all duration-150 cursor-pointer"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0B1F4B] border-t border-white/10 px-4 pt-3 pb-4 space-y-1 shadow-xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-[#D6A21E]/15 text-[#D6A21E] border-l-2 border-[#D6A21E]'
                        : 'text-slate-300 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <div className="pt-3 mt-1 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#D6A21E] text-[#0B1F4B] font-bold text-xs flex items-center justify-center rounded-full">
                  {user?.avatarInitial || 'GM'}
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">{user?.name || 'User'}</span>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">{role}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-[#D6A21E] font-semibold hover:text-white transition-colors cursor-pointer"
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-[#0B1F4B]">Growing Minds Academy</span>
            {' '}— AI-Powered Quiz & Learning Analytics
          </div>
          <div className="flex items-center gap-3 text-[11px] flex-wrap justify-center">
            <span>Offline: IndexedDB</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span>{runtimeModeLabel}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
