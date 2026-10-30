import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { appDataStore } from '../../services/storage';
import { networkManager } from '../../lib/network';
import { syncQueueService, SyncState } from '../../lib/sync-queue';
import { Quiz } from '../../types/quiz';
import { Submission } from '../../types/submission';
import {
  HelpCircle,
  Clock,
  Wifi,
  WifiOff,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Sparkles,
  DownloadCloud,
} from 'lucide-react';

export const LearnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState<Quiz[]>(appDataStore.getQuizzes());
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isOnline, setIsOnline] = useState(networkManager.isOnline());
  const [syncState, setSyncState] = useState<SyncState>(syncQueueService.getState());

  useEffect(() => {
    const unsubNet = networkManager.subscribe((status) => setIsOnline(status));
    const unsubSync = syncQueueService.subscribe((state) => setSyncState(state));
    const unsubStore = appDataStore.subscribe(() => {
      setQuizzes(appDataStore.getQuizzes());
      if (user?.learnerId) {
        setSubmissions(appDataStore.getSubmissionsByLearner(user.learnerId));
      }
    });

    if (user?.learnerId) {
      setSubmissions(appDataStore.getSubmissionsByLearner(user.learnerId));
    }

    return () => {
      unsubNet();
      unsubSync();
      unsubStore();
    };
  }, [user]);

  // Available quizzes for this learner's grade/class
  const submittedQuizIds = new Set(submissions.map((s) => s.quizId));

  const availableQuizzes = quizzes.filter(
    (q) =>
      (q.status === 'in_progress' || q.status === 'published') &&
      !submittedQuizIds.has(q.id)
  );

  // Released results (strictly released only!)
  const releasedQuizzesMap = new Map(
    quizzes.filter((q) => q.status === 'results_released').map((q) => [q.id, q])
  );
  const releasedResults = submissions.filter((s) => releasedQuizzesMap.has(s.quizId));

  const firstName = user?.name ? user.name.split(' ')[0] : 'Learner';

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-2">
      {/* Warm, Focused Tablet Greeting Header */}
      <div className="bg-[#1C2C5B] text-white p-6 sm:p-8 shadow-sm border border-[#1C2C5B]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-[#6CABDD] uppercase tracking-wider">
                {user?.grade || 'Grade not assigned'} • {user?.className || 'Class not assigned'}
              </span>
              <span className="text-white/40">•</span>
              <span className="font-mono text-xs text-slate-300 font-semibold">
                ID: {user?.learnerId || '—'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Ready to show what you know, {firstName}?
            </h1>
            <p className="text-sm text-slate-200 mt-1 max-w-xl">
              Your quizzes are here. Take your time and do your best.
            </p>
          </div>

          {/* Connection Indicator on Tablet */}
          <div className="shrink-0">
            {isOnline ? (
              <div className="flex items-center gap-2 bg-[#0F172A] px-3 py-2 border border-[#6CABDD]/40 text-xs">
                <Wifi size={16} className="text-[#6CABDD]" />
                <div>
                  <span className="font-bold text-white block">Connected</span>
                  <span className="text-[10px] text-slate-300">Quizzes sync live</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#0F172A] px-3 py-2 border border-[#F59E0B]/50 text-xs">
                <WifiOff size={16} className="text-[#FCD34D]" />
                <div>
                  <span className="font-bold text-[#FCD34D] block">Offline Tablet Mode</span>
                  <span className="text-[10px] text-slate-300">Saved offline quizzes available</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Available Quizzes to Take */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-2">
          <h2 className="text-lg font-bold text-[#1C2C5B] uppercase tracking-wider">
            Available Assessments ({availableQuizzes.length})
          </h2>
          <span className="text-xs text-[#64748B]">Assigned by your teacher</span>
        </div>

        {availableQuizzes.length === 0 ? (
          <div className="bg-white border border-[#CBD5E1] p-10 text-center shadow-xs">
            <CheckCircle2 size={32} className="text-[#1C2C5B] mx-auto mb-2" />
            <h3 className="text-base font-bold text-[#1C2C5B]">You're All Caught Up!</h3>
            <p className="text-xs text-[#64748B] mt-1">
              There are no new assessments awaiting completion right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white border border-[#CBD5E1] p-6 shadow-xs hover:border-[#6CABDD] transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-[#6CABDD] uppercase tracking-wider">
                      {quiz.subjectName}
                    </span>
                    {quiz.allowOffline && (
                      <span className="text-[10px] font-semibold text-[#1C2C5B] bg-[#E8F3FC] px-2 py-0.5 border border-[#6CABDD]/30">
                        Saved for Offline
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-[#1C2C5B] mb-2">{quiz.title}</h3>

                  <div className="flex flex-wrap gap-4 text-xs text-[#64748B] mb-4">
                    <span>
                      Questions: <strong className="text-[#0F172A]">{quiz.questions.length}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Time Limit: <strong className="text-[#0F172A]">{quiz.durationMinutes} mins</strong>
                    </span>
                    <span>•</span>
                    <span className="capitalize">{quiz.difficulty} Level</span>
                  </div>

                  {quiz.instructions && (
                    <p className="text-xs text-[#64748B] mb-4 bg-[#F5F8FC] p-2.5 border border-[#CBD5E1]/60">
                      {quiz.instructions}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-[#CBD5E1]">
                  <PrimaryButton
                    onClick={() => navigate(`/learner/take/${quiz.id}`)}
                    className="w-full py-3 text-sm font-bold uppercase tracking-wider justify-center"
                    icon={<ArrowRight size={16} />}
                  >
                    {quiz.allowOffline && !isOnline ? 'Start Offline Quiz' : 'Start Quiz'}
                  </PrimaryButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Released Results Quick View */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-2">
          <h2 className="text-lg font-bold text-[#1C2C5B] uppercase tracking-wider">
            Your Released Results
          </h2>
          <OutlineButton onClick={() => navigate('/learner/results')} className="text-xs py-1">
            View All Marksheets
          </OutlineButton>
        </div>

        {releasedResults.length === 0 ? (
          <div className="bg-white border border-[#CBD5E1] p-8 text-center shadow-xs">
            <p className="text-xs text-[#64748B]">
              Your results aren't available yet. Your teacher will let you know when they're ready.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {releasedResults.slice(0, 2).map((res) => (
              <div
                key={res.id}
                onClick={() => navigate('/learner/results')}
                className="bg-white border border-[#CBD5E1] p-5 shadow-xs hover:border-[#6CABDD] cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="text-[11px] font-bold text-[#6CABDD] uppercase tracking-wider block">
                    {res.subjectName}
                  </span>
                  <h4 className="text-base font-bold text-[#1C2C5B]">{res.quizTitle}</h4>
                  {res.teacherFeedback && (
                    <p className="text-xs text-[#64748B] mt-1 italic">
                      "{res.teacherFeedback}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-xs text-[#64748B] block">Score</span>
                    <span className="text-xl font-extrabold text-[#1C2C5B]">{res.percentage}%</span>
                  </div>
                  <span className="text-xs font-bold text-[#1C2C5B] bg-[#E8F3FC] px-2.5 py-1 border border-[#6CABDD]/40">
                    Released
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
