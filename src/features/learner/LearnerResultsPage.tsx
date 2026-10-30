import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { OutlineButton } from '../../components/ui/Buttons';
import { useAuth } from '../../app/AuthContext';
import { appDataStore } from '../../services/storage';
import { Quiz } from '../../types/quiz';
import { Submission } from '../../types/submission';
import { CheckCircle2, Clock, BookOpen, AlertCircle, Award } from 'lucide-react';

export const LearnerResultsPage: React.FC = () => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>(appDataStore.getQuizzes());
  const [submissions, setSubmissions] = useState<Submission[]>([]);

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

  // STRICT RULE: Only show results for quizzes that have status === 'results_released'
  const releasedQuizzesMap = new Map(
    quizzes.filter((q) => q.status === 'results_released').map((q) => [q.id, q])
  );

  const releasedSubmissions = submissions.filter((s) => releasedQuizzesMap.has(s.quizId));
  const unreleasedSubmissions = submissions.filter((s) => !releasedQuizzesMap.has(s.quizId));

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      <PageHeader
        title="My Released Marksheets & Feedback"
        subtitle="Review scores, teacher commentary, and personalized revision suggestions for completed assessments."
      />

      {/* When no results released */}
      {releasedSubmissions.length === 0 && (
        <div className="bg-white border border-[#CBD5E1] p-12 text-center shadow-xs space-y-3">
          <Clock size={36} className="text-[#6CABDD] mx-auto" />
          <h3 className="text-lg font-bold text-[#1C2C5B]">
            Your results aren't available yet
          </h3>
          <p className="text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
            Your teacher will let you know when marks and feedback are ready. Once published, your score and revision tips will appear right here.
          </p>
        </div>
      )}

      {/* Released Results List */}
      {releasedSubmissions.length > 0 && (
        <div className="space-y-5">
          {releasedSubmissions.map((sub) => {
            const quiz = releasedQuizzesMap.get(sub.quizId);
            return (
              <div
                key={sub.id}
                className="bg-white border border-[#CBD5E1] p-6 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#CBD5E1]/60 gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6CABDD] block mb-1">
                      {sub.subjectName} • Formally Released
                    </span>
                    <h3 className="text-lg font-bold text-[#1C2C5B]">{sub.quizTitle}</h3>
                    <span className="text-xs text-[#64748B]">
                      Completed on {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'Term 2'}
                    </span>
                  </div>

                  {/* Score Callout */}
                  <div className="flex items-center gap-4 bg-[#E8F3FC] px-5 py-3 border border-[#6CABDD]/40">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-[#64748B] block">
                        Raw Score
                      </span>
                      <span className="text-sm font-bold text-[#1C2C5B]">
                        {sub.score} / {sub.totalMarks} Marks
                      </span>
                    </div>
                    <div className="border-l border-[#CBD5E1] pl-4">
                      <span className="text-[11px] font-bold uppercase text-[#64748B] block">
                        Percentage
                      </span>
                      <span className="text-2xl font-extrabold text-[#1C2C5B]">
                        {sub.percentage}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Teacher Feedback Box */}
                {sub.teacherFeedback && (
                  <div className="p-4 bg-[#F5F8FC] border border-[#CBD5E1] text-xs">
                    <span className="font-bold text-[#1C2C5B] uppercase tracking-wider block mb-1">
                      Teacher Commentary:
                    </span>
                    <p className="text-[#0F172A] leading-relaxed italic">
                      "{sub.teacherFeedback}"
                    </p>
                  </div>
                )}

                {/* Topics to Practise (Gap Identification) */}
                {sub.topicsToPractise && sub.topicsToPractise.length > 0 && (
                  <div className="p-4 bg-white border border-[#CBD5E1] text-xs">
                    <span className="font-bold text-[#1C2C5B] uppercase tracking-wider block mb-2">
                      Topics to Practise Next:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {sub.topicsToPractise.map((topic, i) => (
                        <span
                          key={i}
                          className="bg-[#E8F3FC] text-[#1C2C5B] px-3 py-1 text-xs font-semibold border border-[#6CABDD]/40"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* If 100% mastery */}
                {sub.percentage === 100 && (
                  <div className="p-3 bg-[#E8F3FC] border border-[#6CABDD] text-xs text-[#1C2C5B] font-semibold flex items-center gap-2">
                    <Award size={16} className="text-[#1C2C5B]" />
                    <span>Full marks achieved on all objective questions. Outstanding work!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending Unreleased Notice if any quizzes are completed but marks withheld */}
      {unreleasedSubmissions.length > 0 && (
        <div className="p-4 bg-[#F5F8FC] border border-[#CBD5E1] text-xs text-[#64748B]">
          <span className="font-bold text-[#1C2C5B] block mb-1">
            Submitted Assessments Currently Being Marked ({unreleasedSubmissions.length})
          </span>
          <p>
            You have submitted attempts for{' '}
            <strong className="text-[#0F172A]">
              {unreleasedSubmissions.map((s) => s.quizTitle).join(', ')}
            </strong>
            . Marks will be visible here once your teacher releases the cohort results.
          </p>
        </div>
      )}
    </div>
  );
};
