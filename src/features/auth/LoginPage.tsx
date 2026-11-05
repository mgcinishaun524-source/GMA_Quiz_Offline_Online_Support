import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { FormField, InputField } from '../../components/ui/FormControls';
import { PrimaryButton } from '../../components/ui/Buttons';
import { GmaLogo } from '../../components/brand/GmaLogo';
import { Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginStaff, loginLearner } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'staff' | 'learner'>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
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

  return (
    <div className="min-h-screen bg-[#F7F7F4] flex flex-col justify-center items-center py-12 px-4 sm:px-6">
      {/* Brand */}
      <div className="text-center mb-6">
        <GmaLogo size={150} animated className="mx-auto drop-shadow-[0_14px_32px_rgba(214,162,30,0.28)]" />
        <p className="text-xs font-semibold text-[#D6A21E] tracking-widest uppercase mt-1">
          AI-Powered Quiz &amp; Learning Analytics
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Sign In to Your School Portal</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select your role to access quizzes, results, and learning tools.
          </p>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-2 gap-2 mb-6 bg-[#F7F7F4] rounded-xl p-1">
          {(['staff', 'learner'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setActiveTab(tab); setErrorMessage(''); }}
              className={`
                py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all duration-150
                ${activeTab === tab
                  ? 'bg-[#0B1F4B] text-white shadow-sm'
                  : 'text-slate-500 hover:text-[#0B1F4B]'
                }
              `}
            >
              {tab === 'staff' ? 'Teacher / Admin' : 'Learner (Tablet)'}
            </button>
          ))}
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Staff form */}
        {activeTab === 'staff' && (
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <FormField label="School Email Address or Username" required>
              <InputField
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@school.edu or username"
                required
                autoComplete="username"
              />
            </FormField>
            <FormField label="Password" required>
              <InputField
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
            </FormField>
            <PrimaryButton type="submit" isLoading={isLoading} className="w-full mt-2 py-2.5">
              Sign In to Staff Workspace
            </PrimaryButton>
          </form>
        )}

        {/* Learner form */}
        {activeTab === 'learner' && (
          <form onSubmit={handleLearnerSubmit} className="space-y-4">
            <FormField label="Learner ID / Student Number" required helperText="e.g. GMA-2026-0301">
              <InputField
                type="text"
                value={learnerId}
                onChange={(e) => setLearnerId(e.target.value)}
                placeholder="GMA-2026-0301"
                required
              />
            </FormField>
            <FormField label="4-Digit Tablet PIN" required>
              <div className="relative">
                <InputField
                  type={showPin ? 'text' : 'password'}
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="pr-10 text-center tracking-widest font-mono text-base"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0B1F4B] transition-colors cursor-pointer"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>
            <PrimaryButton type="submit" isLoading={isLoading} className="w-full mt-2 py-2.5">
              Start Quiz Portal
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  );
};
