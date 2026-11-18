import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { directoryApiService } from '../../services/directory-api';
import { startDeviceHeartbeat } from '../../services/admin-dashboard-api';
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
  Backpack,
} from 'lucide-react';

/**
 * Application shell — floating glass navigation + content canvas.
 *
 * Every portal (admin / teacher / learner) renders through here. All of the
 * original behaviour is preserved: runtime auth-mode reporting, directory
 * hydration for staff, learner device heartbeat, role-scoped navigation and
 * sign-out. Only the presentation changed (floating glass chrome).
 */
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

  // Learner tablets announce their presence so the admin dashboard can show how
  // many are live right now. Best-effort: it never blocks or interrupts learning.
  useEffect(() => {
    if (role !== 'learner') return;
    return startDeviceHeartbeat();
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

  const RoleIcon = role === 'admin' ? Settings : role === 'teacher' ? GraduationCap : Backpack;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="gma-app min-h-screen flex flex-col">
      <NetworkSimulatorBar />

      {/* ── Floating glass navigation ──────────────────────────────────── */}
      <div className="sticky top-0 z-40 px-3 sm:px-5 lg:px-8 pt-3 pb-2 bg-[linear-gradient(180deg,#F5F8FC_58%,rgba(245,248,252,0))]">
        <header className="gma-nav-glass-navy mx-auto max-w-7xl rounded-2xl overflow-hidden">
          {/* Top row: brand + profile */}
          <div className="px-3 sm:px-4">
            <div className="flex items-center justify-between h-16 gap-3">
              {/* Brand */}
              <div className="flex items-center gap-3 shrink-0 min-w-0">
                <img
                  src="/assets/Logo.png"
                  alt="Growing Minds Academy"
                  className="h-9 w-auto object-contain"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    const fallback = el.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                {/* Fallback text badge if logo fails to load */}
                <div
                  className="w-9 h-9 bg-white/10 border border-white/15 rounded-xl hidden items-center justify-center text-gma-gold font-black text-[10px] tracking-tight"
                  style={{ display: 'none' }}
                  aria-hidden="true"
                >
                  GMA
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-extrabold tracking-tight text-white leading-tight block truncate">
                    Growing Minds Academy
                  </span>
                  <span className="text-[9px] font-bold text-gma-sky/90 tracking-[0.22em] uppercase leading-none">
                    AI Quiz &amp; Analytics
                  </span>
                </div>
              </div>

              {/* Right: role pill + profile */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Role pill — descriptive icon, never a status dot */}
                <div
                  className={[
                    'hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full',
                    'text-[10px] font-bold uppercase tracking-[0.14em] border backdrop-blur-sm',
                    role === 'admin'
                      ? 'bg-gma-gold/15 border-gma-gold/30 text-gma-gold'
                      : 'bg-gma-sky/15 border-gma-sky/30 text-gma-sky',
                  ].join(' ')}
                >
                  <RoleIcon size={12} aria-hidden="true" />
                  <span>{role?.toUpperCase()}</span>
                </div>

                {/* Profile */}
                <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-white/[0.12]">
                  <div className="w-9 h-9 rounded-full bg-gma-sky text-gma-navy-deep font-bold text-xs flex items-center justify-center shrink-0 ring-2 ring-white/15">
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
                    className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.10] active:scale-95 transition-all duration-150 cursor-pointer"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut size={15} />
                  </button>
                </div>

                {/* Mobile hamburger */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2.5 rounded-xl text-white hover:bg-white/[0.10] active:scale-95 transition-all duration-150 cursor-pointer"
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open navigation menu'}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>

          {/* Nav row (desktop only) */}
          <div className="hidden md:block border-t border-white/[0.08] px-3">
            <nav className="flex items-center gap-1 h-12" aria-label="Main navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-2 px-3.5 h-8 rounded-xl text-[11px] font-semibold uppercase tracking-[0.08em]',
                        'transition-all duration-150 whitespace-nowrap',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gma-sky/50',
                        isActive
                          ? 'bg-white/[0.14] text-white ring-1 ring-gma-sky/40 shadow-inner'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.07]',
                      ].join(' ')
                    }
                  >
                    <Icon size={13} className="shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Mobile drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-white/[0.08] px-3 pt-3 pb-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold',
                        'transition-all duration-150',
                        isActive
                          ? 'bg-white/[0.12] text-white ring-1 ring-gma-sky/40'
                          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                      ].join(' ')
                    }
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
              <div className="pt-3 mt-2 border-t border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gma-sky text-gma-navy-deep font-bold text-xs flex items-center justify-center shrink-0">
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
      </div>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Outlet />
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="gma-card rounded-2xl px-5 py-4 text-xs text-gma-muted flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span className="font-bold text-gma-navy">Growing Minds Academy</span>
              {' '}— AI-Powered Quiz &amp; Learning Analytics
            </div>
            <div className="flex items-center gap-3 text-[11px] flex-wrap justify-center">
              <span>Offline: IndexedDB</span>
              <span className="hidden sm:inline text-slate-300">|</span>
              <span>{runtimeModeLabel}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
