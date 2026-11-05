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
      <header className="bg-[#0B1F4B] text-white sticky top-0 z-40 shadow-md">

        {/* ── Top row: brand + profile ─────────────────────────────────── */}
        <div className="border-b border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">

              {/* Brand */}
              <div className="flex items-center gap-3 shrink-0">
                <img
                  src="/assets/Logo.png"
                  alt="Growing Minds Academy"
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    const fallback = el.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                {/* Fallback text badge if logo fails to load */}
                <div
                  className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[#D6A21E] font-black text-[10px] tracking-tight shadow-inner"
                  style={{ display: 'none' }}
                  aria-hidden="true"
                >
                  GMA
                </div>
                <div>
                  <span className="text-sm font-extrabold tracking-tight text-white leading-tight block">
                    Growing Minds Academy
                  </span>
                  <span className="text-[9px] font-bold text-[#D6A21E]/80 tracking-[0.2em] uppercase leading-none">
                    AI Quiz & Analytics
                  </span>
                </div>
              </div>

              {/* Right: role pill + profile */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Role pill */}
                <div className={`
                  hidden sm:flex items-center gap-2 px-3 py-1 
                  rounded-full text-[10px] font-black uppercase tracking-[0.15em] 
                  ${role === 'admin' 
                    ? 'bg-[#D6A21E]/10 border-[#D6A21E]/20 text-[#D6A21E]' 
                    : 'bg-[#6CABDD]/10 border-[#6CABDD]/20 text-[#6CABDD]'
                  } 
                  border backdrop-blur-sm transition-all duration-300 hover:bg-white/5
                `}>
                  {role === 'admin' ? <Settings size={12} /> : <GraduationCap size={12} />}
                  <span>{role?.toUpperCase()}</span>
                </div>

                {/* Profile */}
                <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/[0.12]">
                  <div className="w-8 h-8 rounded-full bg-[#D6A21E] text-[#0B1F4B] font-bold text-xs flex items-center justify-center shrink-0 ring-2 ring-[#D6A21E]/20">
                    {user?.avatarInitial || 'GM'}
                  </div>
                  <div className="hidden md:block text-left min-w-0">
                    <span className="text-xs font-semibold text-white block leading-tight truncate max-w-[180px]" title={user?.name || ''}>
                      {user?.name || 'Authorized User'}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate max-w-[180px]" title={user?.email || ''}>
                      {user?.email || 'School Access'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.09] active:scale-95 transition-all duration-150 cursor-pointer"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut size={14} />
                  </button>
                </div>

                {/* Mobile hamburger */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-white hover:bg-white/[0.09] active:scale-95 transition-all duration-150 cursor-pointer"
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open navigation menu'}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Nav row (desktop only) ──────────────────────────────────── */}
        <div className="hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-stretch h-10 overflow-x-auto scrollbar-none" aria-label="Main navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-1.5 px-4 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap',
                        'border-b-2 transition-all duration-150',
                        'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[#D6A21E]/50',
                        isActive
                          ? 'border-[#D6A21E] text-white'
                          : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]',
                      ].join(' ')
                    }
                  >
                    <Icon size={12} className="shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* ── Mobile drawer ───────────────────────────────────────────── */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.08] px-4 pt-3 pb-4 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold',
                      'border-l-2 transition-all duration-150',
                      isActive
                        ? 'bg-white/[0.08] text-white border-[#D6A21E] pl-[10px]'
                        : 'text-slate-400 border-transparent hover:bg-white/[0.06] hover:text-slate-100',
                    ].join(' ')
                  }
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <div className="pt-3 mt-2 border-t border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#D6A21E] text-[#0B1F4B] font-bold text-xs flex items-center justify-center shrink-0">
                  {user?.avatarInitial || 'GM'}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate max-w-[180px]">{user?.name || 'User'}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">{role}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer ml-3 shrink-0">
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
