import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { appDataStore } from '../../services/storage';
import { Quiz } from '../../types/quiz';
import { Submission } from '../../types/submission';
import { ArrowRight, CheckCircle2, Clock, BookOpen, AlertCircle } from 'lucide-react';

export const LearnerQuizzesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState<Quiz[]>(appDataStore.getQuizzes());
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available');

  useEffect(() => {
    return appDataStore.subscribe(() => {
      setQuizzes(appDataStore.getQuizzes());
      if (user?.learnerId) {
        setSubmissions(appDataStore.getSubmissionsByLearner(user.learnerId));
      }
    });
  }, [user]);

  useEffect(() => {
    if (user?.learnerId) {
      setSubmissions(appDataStore.getSubmissionsByLearner(user.learnerId));
    }
  }, [user]);

  const submittedQuizIds = new Set(submissions.map((s) => s.quizId));

  const availableQuizzes = quizzes.filter(
    (q) =>
      (q.status === 'in_progress' || q.status === 'published') &&
      !submittedQuizIds.has(q.id)
  );

  const completedQuizzes = quizzes.filter((q) => submittedQuizIds.has(q.id));

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      <PageHeader
        title="My School Assessments"
        subtitle="Review upcoming quizzes and check the submission status of your completed tests."
      />

      {/* Clean Tab Switcher */}
      <div className="grid grid-cols-2 gap-2 border-b border-[#CBD5E1] pb-3">
        <button
          onClick={() => setActiveTab('available')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
            activeTab === 'available'
              ? 'bg-[#1C2C5B] text-white border-[#1C2C5B]'
              : 'bg-white text-[#64748B] border-[#CBD5E1] hover:text-[#1C2C5B]'
          }`}
        >
          Available to Take ({availableQuizzes.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
            activeTab === 'completed'
              ? 'bg-[#1C2C5B] text-white border-[#1C2C5B]'
              : 'bg-white text-[#64748B] border-[#CBD5E1] hover:text-[#1C2C5B]'
          }`}
        >
          Completed Submissions ({completedQuizzes.length})
        </button>
      </div>

      {activeTab === 'available' && (
        <div className="space-y-4">
          {availableQuizzes.length === 0 ? (
            <div className="bg-white border border-[#CBD5E1] p-10 text-center shadow-xs">
              <CheckCircle2 size={32} className="text-[#1C2C5B] mx-auto mb-2" />
              <h3 className="text-base font-bold text-[#1C2C5B]">No Pending Quizzes</h3>
              <p className="text-xs text-[#64748B] mt-1">
                You have completed all currently active assessments.
              </p>
            </div>
          ) : (
            availableQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white border border-[#CBD5E1] p-6 shadow-xs hover:border-[#6CABDD] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-[#6CABDD] uppercase tracking-wider">
                      {quiz.subjectName}
                    </span>
                    <span className="text-[#CBD5E1]">•</span>
                    <span className="text-xs text-[#64748B]">{quiz.durationMinutes} Minutes</span>
                  </div>
                  <h3 className="text-base font-bold text-[#1C2C5B]">{quiz.title}</h3>
                  <p className="text-xs text-[#64748B] mt-1">
                    {quiz.questions.length} Questions • Topics:{' '}
                    {quiz.topicsCovered.slice(0, 3).join(', ')}
                  </p>
                </div>

                <div className="shrink-0">
                  <PrimaryButton
                    onClick={() => navigate(`/learner/take/${quiz.id}`)}
                    className="py-2.5 px-5 text-xs font-bold uppercase tracking-wider"
                    icon={<ArrowRight size={14} />}
                  >
                    Start Assessment
                  </PrimaryButton>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div className="space-y-4">
          {completedQuizzes.length === 0 ? (
            <div className="bg-white border border-[#CBD5E1] p-10 text-center shadow-xs">
              <p className="text-xs text-[#64748B]">You haven't completed any quizzes yet.</p>
            </div>
          ) : (
            completedQuizzes.map((quiz) => {
              const sub = submissions.find((s) => s.quizId === quiz.id);
              const isReleased = quiz.status === 'results_released';

              return (
                <div
                  key={quiz.id}
                  className="bg-white border border-[#CBD5E1] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-xs font-bold text-[#6CABDD] uppercase tracking-wider block mb-1">
                      {quiz.subjectName}
                    </span>
                    <h3 className="text-base font-bold text-[#1C2C5B]">{quiz.title}</h3>
                    <div className="text-xs text-[#64748B] mt-1 flex items-center gap-2">
                      <span>Submitted: {sub?.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Recorded'}</span>
                      <span>•</span>
                      <span>
                        {sub?.isOfflineSubmission ? 'Saved Offline (Synced)' : 'Online Submission'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isReleased ? (
                      <PrimaryButton
                        onClick={() => navigate('/learner/results')}
                        className="text-xs py-2 px-4"
                      >
                        View Marksheet
                      </PrimaryButton>
                    ) : (
                      <div className="p-2.5 bg-[#F5F8FC] border border-[#CBD5E1] text-xs text-right">
                        <span className="font-bold text-[#1C2C5B] block">Marks Awaiting Release</span>
                        <span className="text-[10px] text-[#64748B]">Teacher reviewing cohort</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
