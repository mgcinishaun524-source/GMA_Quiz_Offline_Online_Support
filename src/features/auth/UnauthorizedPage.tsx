import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { ShieldAlert } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();

  const handleReturnHome = () => {
    if (role === 'admin') navigate('/admin/dashboard');
    else if (role === 'teacher') navigate('/teacher/dashboard');
    else if (role === 'learner') navigate('/learner/dashboard');
    else navigate('/login');
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="gma-card rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-[#FEE2E2] border border-[#B91C1C] flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={24} className="text-[#B91C1C]" />
        </div>
        <h2 className="text-xl font-bold text-gma-navy uppercase tracking-tight">Access Restricted</h2>
        <p className="text-sm text-gma-muted mt-2 mb-6">
          You do not have permission to view this section with your current role (
          <span className="font-semibold text-[#0F172A]">{role?.toUpperCase() || 'ANONYMOUS'}</span>
          ).
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <PrimaryButton onClick={handleReturnHome}>
            Return to My Portal
          </PrimaryButton>
          <OutlineButton onClick={() => navigate('/login')}>
            Switch Account
          </OutlineButton>
        </div>
      </div>
    </div>
  );
};
