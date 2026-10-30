import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { FormField, InputField } from '../../components/ui/FormControls';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { Eye, EyeOff, ShieldCheck, GraduationCap, School } from 'lucide-react';

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
    if (!email) {
      setErrorMessage('Please enter your school email address or username.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }
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
    if (!learnerId || !pin) {
      setErrorMessage('Please enter both your Student Number and 4-digit PIN.');
      return;
    }
    setIsLoading(true);
    try {
      const user = await loginLearner(learnerId, pin);
      navigate('/learner/dashboard');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="text-center mb-8 max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-[#1C2C5B] border-2 border-[#6CABDD] mb-3">
          <span className="text-xl font-bold text-[#6CABDD] tracking-wider">GMA</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2C5B] tracking-tight uppercase">
          Growing Minds Academy
        </h1>
        <p className="text-xs font-semibold text-[#6CABDD] tracking-widest uppercase mt-1">
          AI-Powered Quiz & Learning Analytics System
        </p>
      </div>

      {/* Main Login Card */}
      <div className="bg-white border border-[#CBD5E1] shadow-md w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 pb-3 border-b border-[#CBD5E1]">
          <h2 className="text-lg font-bold text-[#0F172A]">Sign In to Your School Portal</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Select your role to access quizzes, results, and learning tools.
          </p>
        </div>

        {/* Role Tab Selector */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('staff');
              setErrorMessage('');
            }}
            className={`py-2 px-3 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
              activeTab === 'staff'
                ? 'bg-[#1C2C5B] text-white border-[#1C2C5B]'
                : 'bg-[#F5F8FC] text-[#64748B] border-[#CBD5E1] hover:text-[#1C2C5B]'
            }`}
          >
            Teacher / Admin
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('learner');
              setErrorMessage('');
            }}
            className={`py-2 px-3 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
              activeTab === 'learner'
                ? 'bg-[#1C2C5B] text-white border-[#1C2C5B]'
                : 'bg-[#F5F8FC] text-[#64748B] border-[#CBD5E1] hover:text-[#1C2C5B]'
            }`}
          >
            Learner (Tablet)
          </button>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3 bg-[#FEE2E2] border border-[#B91C1C]/40 text-[#B91C1C] text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Staff Form */}
        {activeTab === 'staff' && (
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <FormField label="School Email Address" required>
              <InputField
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@gma.edu"
                required
              />
            </FormField>

            <FormField label="Password" required>
              <InputField
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </FormField>

            <PrimaryButton type="submit" isLoading={isLoading} className="w-full mt-2">
              Sign In to Staff Workspace
            </PrimaryButton>
          </form>
        )}

        {/* Learner Form */}
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
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1C2C5B]"
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>

            <PrimaryButton type="submit" isLoading={isLoading} className="w-full mt-2">
              Start Quiz Portal
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  );
};
