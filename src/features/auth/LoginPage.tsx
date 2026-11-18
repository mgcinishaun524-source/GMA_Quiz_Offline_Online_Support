import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { AuthModeSwitch, type AuthMode } from './components/AuthModeSwitch';
import { AuthSubmitButton } from './components/AuthSubmitButton';
import { AuthTextField } from './components/AuthTextField';
import { LoginBrandPanel } from './components/LoginBrandPanel';
import {
  AlertCircle,
  BadgeCheck,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

/** Small icon button that toggles the visibility of a password / PIN field. */
const VisibilityToggle: React.FC<{
  shown: boolean;
  onToggle: () => void;
  labelShow: string;
  labelHide: string;
}> = ({ shown, onToggle, labelShow, labelHide }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={shown ? labelHide : labelShow}
    aria-pressed={shown}
    title={shown ? labelHide : labelShow}
    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gma-navy/50 transition-colors duration-150 hover:bg-gma-navy/8 hover:text-gma-navy cursor-pointer"
  >
    {shown ? <EyeOff size={17} /> : <Eye size={17} />}
  </button>
);

export const LoginPage: React.FC = () => {
  const { loginStaff, loginLearner } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AuthMode>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email) { setErrorMessage('Please enter your school email address or username.'); return; }
    if (!password) { setErrorMessage('Please enter your password.'); return; }
    setIsLoading(true);
    try {
      const user = await loginStaff(email, password);
      navigate(`/${user.role}/dashboard`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLearnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!learnerId || !pin) { setErrorMessage('Please enter both your Student Number and 4-digit PIN.'); return; }
    setIsLoading(true);
    try {
      await loginLearner(learnerId, pin);
      navigate('/learner/dashboard');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (mode: AuthMode) => {
    setActiveTab(mode);
    setErrorMessage('');
  };

  return (
    <div className="gma-auth relative min-h-screen w-full">
      {/* Decorative background: dotted grid + slow ambient orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="gma-auth-grid absolute inset-0" />
        <div className="gma-orb h-64 w-64 bg-gma-sky/60" style={{ top: '-6rem', left: '-4rem' }} />
        <div className="gma-orb gma-orb-b h-72 w-72 bg-gma-navy/25" style={{ bottom: '-9rem', right: '-6rem' }} />
        <div className="gma-orb gma-orb-c h-56 w-56 bg-[#9FC8E9]/60" style={{ top: '38%', right: '20%' }} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[92rem] items-stretch gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {/* Left: brand + illustration (desktop / large tablet only) */}
        <section className="hidden min-w-0 flex-1 lg:block">
          <LoginBrandPanel />
        </section>

        {/* Right: login panel */}
        <section className="flex w-full min-w-0 flex-1 items-center justify-center lg:w-[28rem] lg:flex-none xl:w-[32rem]">
          <div className="w-full max-w-md">
            {/* Compact brand lockup for phone & tablet, where the art is hidden */}
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <img
                src="/assets/Logo.png"
                alt="Growing Minds Academy"
                className="h-20 w-auto sm:h-24"
              />
              <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-gma-navy/70">
                AI-Powered Quiz &amp; Learning Analytics
              </p>
            </div>

            <div
              className="gma-glass gma-glass-strong rounded-[1.75rem] p-6 sm:p-8"
              style={{ animation: 'gma-rise 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both' }}
            >
              <header className="mb-6">
                <h1 className="text-xl font-extrabold tracking-tight text-gma-navy sm:text-2xl">
                  Sign in to your portal
                </h1>
                <p className="mt-1.5 text-sm text-slate-600">
                  Choose how you want to access quizzes, results and learning tools.
                </p>
              </header>

              <AuthModeSwitch value={activeTab} onChange={handleModeChange} />

              {errorMessage && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-300/70 bg-red-50/90 px-3.5 py-3 text-sm font-medium text-red-700"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {activeTab === 'staff' ? (
                /* ── Staff sign-in ───────────────────────────────────────── */
                <form
                  onSubmit={handleStaffSubmit}
                  role="tabpanel"
                  id="gma-login-panel-staff"
                  aria-labelledby="gma-login-tab-staff"
                  className="mt-6 space-y-4"
                >
                  <AuthTextField
                    label="School Email or Username"
                    icon={<UserRound size={17} />}
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.name@school.edu"
                    autoComplete="username"
                    spellCheck={false}
                    required
                    disabled={isLoading}
                  />
                  <AuthTextField
                    label="Password"
                    icon={<Lock size={17} />}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    trailing={
                      <VisibilityToggle
                        shown={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        labelShow="Show password"
                        labelHide="Hide password"
                      />
                    }
                  />
                  <AuthSubmitButton isLoading={isLoading}>Sign In to Staff Workspace</AuthSubmitButton>
                </form>
              ) : (
                /* ── Learner sign-in ─────────────────────────────────────── */
                <form
                  onSubmit={handleLearnerSubmit}
                  role="tabpanel"
                  id="gma-login-panel-learner"
                  aria-labelledby="gma-login-tab-learner"
                  className="mt-6 space-y-4"
                >
                  <AuthTextField
                    label="Learner ID / Student Number"
                    icon={<BadgeCheck size={17} />}
                    type="text"
                    value={learnerId}
                    onChange={(e) => setLearnerId(e.target.value)}
                    placeholder="GMA-2026-0301"
                    autoComplete="username"
                    spellCheck={false}
                    hint="e.g. GMA-2026-0301"
                    required
                    disabled={isLoading}
                  />
                  <AuthTextField
                    label="4-Digit Tablet PIN"
                    icon={<Lock size={17} />}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="text-center font-semibold tracking-[0.55em]"
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    trailing={
                      <VisibilityToggle
                        shown={showPin}
                        onToggle={() => setShowPin((v) => !v)}
                        labelShow="Show PIN"
                        labelHide="Hide PIN"
                      />
                    }
                  />
                  <AuthSubmitButton isLoading={isLoading}>Start Quiz Portal</AuthSubmitButton>
                </form>
              )}
            </div>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
              <ShieldCheck size={14} aria-hidden="true" className="text-gma-sky" />
              Secure access · Growing Minds Academy
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
