import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { CheckCircle2, Clock, Wifi, WifiOff, FileCheck, ArrowRight } from 'lucide-react';

export const LearnerSubmittedPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const quizTitle = searchParams.get('quizTitle') || 'Assessment';
  const isOffline = searchParams.get('offline') === 'true';
  const submissionId = searchParams.get('id') || 'Recorded';

  return (
    <div className="max-w-xl mx-auto my-10 bg-white border border-[#CBD5E1] p-8 shadow-sm text-center space-y-6">
      {/* Icon & Honest Status */}
      <div
        className={`w-16 h-16 mx-auto flex items-center justify-center border ${
          isOffline
            ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#92400E]'
            : 'bg-[#E8F3FC] border-[#1C2C5B] text-[#1C2C5B]'
        }`}
      >
        {isOffline ? <Clock size={32} /> : <CheckCircle2 size={32} />}
      </div>

      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#6CABDD] block mb-1">
          Submission Receipt
        </span>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C2C5B]">
          {isOffline ? 'Assessment Saved Locally on Tablet' : 'Assessment Successfully Submitted'}
        </h1>
        <p className="text-sm font-semibold text-[#0F172A] mt-2">{quizTitle}</p>
      </div>

      {/* Honest Status Explanation */}
      <div
        className={`p-4 border text-left text-xs leading-relaxed space-y-2 ${
          isOffline
            ? 'bg-[#FEF3C7]/50 border-[#F59E0B]/50 text-[#92400E]'
            : 'bg-[#F5F8FC] border-[#CBD5E1] text-[#0F172A]'
        }`}
      >
        {isOffline ? (
          <>
            <p className="font-bold flex items-center gap-1.5">
              <WifiOff size={14} /> Pending Network Synchronization
            </p>
            <p>
              Your answers have been securely recorded in this tablet's local storage. Because there was no active internet connection when you finished, your test is waiting in the queue.
            </p>
            <p className="font-medium">
              It will automatically upload to your teacher as soon as this tablet connects to the school network.
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-[#1C2C5B] flex items-center gap-1.5">
              <Wifi size={14} className="text-[#6CABDD]" /> Received by School Server
            </p>
            <p className="text-[#64748B]">
              Your responses have been successfully transmitted and logged on the Growing Minds Academy assessment server.
            </p>
          </>
        )}
      </div>

      {/* Result Release Explanation */}
      <div className="bg-[#E8F3FC] border border-[#6CABDD]/40 p-4 text-xs text-left">
        <span className="font-bold text-[#1C2C5B] block mb-1">When will marks be released?</span>
        <p className="text-[#0F172A]">
          Your teacher will review cohort results and release marksheets once all students have finished. Check <strong>"My Results"</strong> later to see your score, percentage, and practice suggestions.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        <PrimaryButton
          onClick={() => navigate('/learner/dashboard')}
          icon={<ArrowRight size={14} />}
        >
          Return to Dashboard
        </PrimaryButton>
        <OutlineButton onClick={() => navigate('/learner/quizzes')}>
          View My Quizzes
        </OutlineButton>
      </div>
    </div>
  );
};
