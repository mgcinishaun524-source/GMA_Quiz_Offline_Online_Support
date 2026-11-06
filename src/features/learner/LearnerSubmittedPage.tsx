import React, { useCallback, useSyncExternalStore } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { submissionReceiptStore } from '../../services/submission-receipt';
import type { ReceiptStatus } from '../../services/submission-receipt';
import {
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

export const LearnerSubmittedPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Live submission status. The learner is routed here the instant they confirm,
  // before the server has answered, so this page subscribes to the receipt store
  // and re-renders as the real outcome arrives (saving → saved / offline / rejected).
  const receipt = useSyncExternalStore(
    useCallback((cb: () => void) => submissionReceiptStore.subscribe(cb), []),
    () => submissionReceiptStore.get()
  );

  const quizTitle = searchParams.get('quizTitle') || 'Assessment';
  const submissionId = searchParams.get('id') || 'Recorded';

  // Trust the live receipt only when it belongs to this submission; otherwise fall
  // back to the query-param view (e.g. a reload after the receipt was cleared).
  const status: ReceiptStatus =
    receipt && receipt.submissionId === submissionId
      ? receipt.status
      : searchParams.get('offline') === 'true'
      ? 'offline'
      : 'saved';

  const quizId = receipt?.quizId;

  const iconShell: Record<ReceiptStatus, string> = {
    saving: 'bg-[#F7F7F4] border-[#D6A21E] text-[#0B1F4B]',
    saved: 'bg-[#F7F7F4] border-[#0B1F4B] text-[#0B1F4B]',
    offline: 'bg-[#FEF3C7] border-[#F59E0B] text-[#92400E]',
    rejected: 'bg-[#FEF2F2] border-[#EF4444] text-[#991B1B]',
  };

  const heading: Record<ReceiptStatus, string> = {
    saving: 'Submitting Your Assessment…',
    saved: 'Assessment Successfully Submitted',
    offline: 'Assessment Saved Locally on Tablet',
    rejected: 'Assessment Not Submitted',
  };

  return (
    <div className="max-w-xl mx-auto my-10 bg-white border border-[#CBD5E1] p-8 shadow-sm text-center space-y-6">
      {/* Icon & Honest Status */}
      <div
        className={`w-16 h-16 mx-auto flex items-center justify-center border ${iconShell[status]}`}
      >
        {status === 'saving' && <Loader2 size={32} className="animate-spin" />}
        {status === 'saved' && <CheckCircle2 size={32} />}
        {status === 'offline' && <Clock size={32} />}
        {status === 'rejected' && <AlertCircle size={32} />}
      </div>

      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#D6A21E] block mb-1">
          Submission Receipt
        </span>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B1F4B]">{heading[status]}</h1>
        <p className="text-sm font-semibold text-[#0F172A] mt-2">{quizTitle}</p>
      </div>

      {/* Honest Status Explanation */}
      {status === 'saving' && (
        <div className="p-4 border text-left text-xs leading-relaxed space-y-2 bg-[#F7F7F4] border-[#CBD5E1] text-[#0F172A]">
          <p className="font-bold text-[#0B1F4B] flex items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" /> Sending to School Server
          </p>
          <p className="text-[#64748B]">
            Your answers are being transmitted to the Growing Minds Academy assessment server. This usually takes a moment — please stay on this page.
          </p>
        </div>
      )}

      {status === 'offline' && (
        <div className="p-4 border text-left text-xs leading-relaxed space-y-2 bg-[#FEF3C7]/50 border-[#F59E0B]/50 text-[#92400E]">
          <p className="font-bold flex items-center gap-1.5">
            <WifiOff size={14} /> Pending Network Synchronization
          </p>
          <p>
            Your answers have been securely recorded in this tablet's local storage. Because there was no active internet connection when you finished, your test is waiting in the queue.
          </p>
          <p className="font-medium">
            It will automatically upload to your teacher as soon as this tablet connects to the school network.
          </p>
        </div>
      )}

      {status === 'saved' && (
        <div className="p-4 border text-left text-xs leading-relaxed space-y-2 bg-[#F7F7F4] border-[#CBD5E1] text-[#0F172A]">
          <p className="font-bold text-[#0B1F4B] flex items-center gap-1.5">
            <Wifi size={14} className="text-[#D6A21E]" /> Received by School Server
          </p>
          <p className="text-[#64748B]">
            Your responses have been successfully transmitted and logged on the Growing Minds Academy assessment server.
          </p>
        </div>
      )}

      {status === 'rejected' && (
        <div className="p-4 border text-left text-xs leading-relaxed space-y-2 bg-[#FEF2F2] border-[#EF4444]/50 text-[#991B1B]">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle size={14} /> Submission Rejected
          </p>
          <p>{receipt?.error || 'The school server could not record this attempt.'}</p>
          <p className="font-medium">
            Your answers are still saved on this tablet. Please tell your teacher before trying again.
          </p>
        </div>
      )}

      {/* Result Release Explanation — only once the attempt is safely on record */}
      {(status === 'saved' || status === 'offline') && (
        <div className="bg-[#F7F7F4] border border-[#D6A21E]/40 p-4 text-xs text-left">
          <span className="font-bold text-[#0B1F4B] block mb-1">When will marks be released?</span>
          <p className="text-[#0F172A]">
            Your teacher will review cohort results and release marksheets once all students have finished. Check <strong>"My Results"</strong> later to see your score, percentage, and practice suggestions.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        {status === 'rejected' && quizId ? (
          <>
            <PrimaryButton
              onClick={() => navigate(`/learner/take/${quizId}`)}
              icon={<ArrowLeft size={14} />}
            >
              Return to Quiz
            </PrimaryButton>
            <OutlineButton onClick={() => navigate('/learner/dashboard')}>
              Return to Dashboard
            </OutlineButton>
          </>
        ) : (
          <>
            <PrimaryButton
              onClick={() => navigate('/learner/dashboard')}
              icon={<ArrowRight size={14} />}
            >
              Return to Dashboard
            </PrimaryButton>
            <OutlineButton onClick={() => navigate('/learner/quizzes')}>
              View My Quizzes
            </OutlineButton>
          </>
        )}
      </div>
    </div>
  );
};
