import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { SelectField } from '../../components/ui/FormControls';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { appDataStore } from '../../services/storage';
import { quizApiService } from '../../services/quiz-api';
import { Quiz } from '../../types/quiz';
import { Submission } from '../../types/submission';
import { Learner } from '../../types/learner';
import {
  CheckCircle2,
  Lock,
  BarChart3,
  Users,
  AlertCircle,
  HelpCircle,
  Clock,
  Eye,
  FileCheck,
} from 'lucide-react';

export const TeacherResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuizId = searchParams.get('quizId');

  const [quizzes, setQuizzes] = useState<Quiz[]>(appDataStore.getQuizzes());
  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    initialQuizId || quizzes[0]?.id || ''
  );
  const [submissions, setSubmissions] = useState<Submission[]>(appDataStore.getSubmissions());
  const [learners, setLearners] = useState<Learner[]>(appDataStore.getLearners());

  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [releaseFeedback, setReleaseFeedback] = useState('');

  useEffect(() => {
    return appDataStore.subscribe(() => {
      setQuizzes(appDataStore.getQuizzes());
      setSubmissions(appDataStore.getSubmissions());
      setLearners(appDataStore.getLearners());
    });
  }, []);

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0];
  const quizSubmissions = submissions.filter((s) => s.quizId === selectedQuiz?.id);
  const cohortLearners = learners.filter((l) => l.classId === selectedQuiz?.classId);

  // Absent or incomplete learners
  const submittedLearnerIds = new Set(quizSubmissions.map((s) => s.learnerId));
  const absentLearners = cohortLearners.filter((l) => !submittedLearnerIds.has(l.id));

  // Averages & Score Distribution
  const scoredSubs = quizSubmissions.filter((s) => s.status === 'marked' || s.score !== undefined);
  const averagePercentage =
    scoredSubs.length > 0
      ? Math.round(scoredSubs.reduce((acc, s) => acc + s.percentage, 0) / scoredSubs.length)
      : 0;

  const [selectedSubForFeedback, setSelectedSubForFeedback] = useState<Submission | null>(null);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [scoreInput, setScoreInput] = useState('');

  const handleOpenFeedbackModal = (sub: Submission) => {
    setSelectedSubForFeedback(sub);
    setFeedbackInput(sub.teacherFeedback || '');
    setScoreInput(String(sub.score));
  };

  const handleSaveFeedback = async () => {
    if (!selectedSubForFeedback) return;
    const adjustedScore = scoreInput.trim() !== '' ? Number(scoreInput) : undefined;
    await quizApiService.recordTeacherFeedback(selectedSubForFeedback.id, feedbackInput, adjustedScore);
    setSelectedSubForFeedback(null);
  };

  const handleReleaseResults = async () => {
    if (selectedQuiz) {
      await quizApiService.releaseResults(selectedQuiz.id);
      setIsReleaseModalOpen(false);
    }
  };

  const isReleased = selectedQuiz?.status === 'results_released';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Marks & Result Release Console"
        subtitle="Review cohort auto-marking, verify absent learner exceptions, and control result publication to student tablets."
        actions={
          <div className="flex gap-2">
            {!isReleased && (
              <PrimaryButton
                onClick={() => setIsReleaseModalOpen(true)}
                icon={<CheckCircle2 size={14} />}
              >
                Release Results to Learners
              </PrimaryButton>
            )}
            {isReleased && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C2C5B] text-white text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 size={14} className="text-[#6CABDD]" />
                <span>Results Currently Released</span>
              </div>
            )}
          </div>
        }
      />

      {/* Quiz Selector Dropdown Bar */}
      <div className="bg-white border border-[#CBD5E1] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1C2C5B] shrink-0">
            Select Assessment:
          </span>
          <SelectField
            value={selectedQuiz?.id}
            onChange={(e) => setSelectedQuizId(e.target.value)}
            className="text-xs py-1.5 font-semibold w-full sm:w-96"
          >
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} ({q.className} — {q.status.toUpperCase()})
              </option>
            ))}
          </SelectField>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#64748B]">Current Status:</span>
          <StatusLabel status={selectedQuiz?.status || 'draft'} />
        </div>
      </div>

      {selectedQuiz && (
        <>
          {/* Performance Overview Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
                Cohort Mean Score
              </span>
              <div className="text-3xl font-extrabold text-[#1C2C5B]">{averagePercentage}%</div>
              <p className="text-xs text-[#64748B] mt-1">Based on {scoredSubs.length} completed attempts</p>
            </div>

            <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
                Cohort Turnout
              </span>
              <div className="text-3xl font-extrabold text-[#1C2C5B]">
                {quizSubmissions.length} / {cohortLearners.length}
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                {absentLearners.length > 0 ? (
                  <span className="text-[#B45309] font-medium">
                    {absentLearners.length} student{absentLearners.length === 1 ? '' : 's'} absent
                  </span>
                ) : (
                  '100% cohort attendance'
                )}
              </p>
            </div>

            <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
                Release Mode
              </span>
              <div className="text-3xl font-extrabold text-[#1C2C5B] uppercase">
                {selectedQuiz.releasePolicy}
              </div>
              <p className="text-xs text-[#64748B] mt-1">
                {isReleased ? 'Published to learner portals' : 'Locked awaiting teacher release'}
              </p>
            </div>

            <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
                Passing Standard
              </span>
              <div className="text-3xl font-extrabold text-[#1C2C5B]">60%</div>
              <p className="text-xs text-[#64748B] mt-1">School mastery benchmark</p>
            </div>
          </div>

          {/* Results Privacy Warning */}
          {!isReleased && (
            <div className="p-4 bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] text-xs flex items-center justify-between shadow-xs">
              <div>
                <strong className="block font-bold">Marks Withheld from Student Portals</strong>
                <span>
                  Learners viewing their portal will see a friendly message indicating results are pending teacher approval.
                  Review the marksheet below, then click "Release Results to Learners".
                </span>
              </div>
              <PrimaryButton
                onClick={() => setIsReleaseModalOpen(true)}
                className="text-xs py-1.5 whitespace-nowrap shrink-0"
              >
                Authorize Release
              </PrimaryButton>
            </div>
          )}

          {/* Individual Learner Submissions Table */}
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
                  Individual Learner Marksheet & Responses
                </h3>
                <p className="text-xs text-[#64748B]">
                  Auto-marked objective scores, completion timestamps, and sync origin
                </p>
              </div>
              <span className="text-xs text-[#64748B]">
                {quizSubmissions.length} Submitted / {absentLearners.length} Absent
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1C2C5B] text-white">
                    <th className="p-2.5 font-semibold uppercase">Learner ID</th>
                    <th className="p-2.5 font-semibold uppercase">Student Name</th>
                    <th className="p-2.5 font-semibold uppercase">Raw Score</th>
                    <th className="p-2.5 font-semibold uppercase">Percentage</th>
                    <th className="p-2.5 font-semibold uppercase">Submission Origin</th>
                    <th className="p-2.5 font-semibold uppercase">Learner Visibility</th>
                    <th className="p-2.5 font-semibold uppercase text-right">Teacher Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]/60">
                  {quizSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[#F5F8FC]">
                      <td className="p-2.5 font-mono font-bold text-[#1C2C5B]">{sub.learnerId}</td>
                      <td className="p-2.5 font-semibold text-[#0F172A]">{sub.learnerName}</td>
                      <td className="p-2.5 font-bold text-[#0F172A]">
                        {sub.score} / {sub.totalMarks}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`font-bold px-2 py-0.5 ${
                            sub.percentage >= 60
                              ? 'bg-[#E8F3FC] text-[#1C2C5B] border border-[#6CABDD]/40'
                              : 'bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]'
                          }`}
                        >
                          {sub.percentage}%
                        </span>
                      </td>
                      <td className="p-2.5 text-[#64748B]">
                        {sub.isOfflineSubmission ? 'Tablet (Synced)' : 'Online Web'}
                      </td>
                      <td className="p-2.5 font-medium">
                        {isReleased ? (
                          <span className="text-[#1C2C5B] font-bold">Released</span>
                        ) : (
                          <span className="text-[#64748B]">Withheld</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <OutlineButton
                          onClick={() => handleOpenFeedbackModal(sub)}
                          className="text-[11px] py-0.5 px-2 font-medium"
                        >
                          Review & Feedback
                        </OutlineButton>
                      </td>
                    </tr>
                  ))}

                  {/* Absent learners clearly identified */}
                  {absentLearners.map((absent) => (
                    <tr key={absent.id} className="bg-[#F8FAFC] text-[#94A3B8]">
                      <td className="p-2.5 font-mono">{absent.id}</td>
                      <td className="p-2.5 font-medium">
                        {absent.firstName} {absent.lastName} (Absent)
                      </td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">—</td>
                      <td className="p-2.5">Unattempted</td>
                      <td className="p-2.5 text-right">No Submission</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Dialog before Result Release */}
      <ConfirmDialog
        isOpen={isReleaseModalOpen}
        title="Release Results to Learner Tablets"
        message={`Authorize immediate release of marks for "${selectedQuiz?.title}"? Once released, all students who completed this assessment will be able to view their score, percentage, and topic feedback on their tablets. (Absent students will not be affected).`}
        confirmLabel="Confirm & Release Now"
        onConfirm={handleReleaseResults}
        onCancel={() => setIsReleaseModalOpen(false)}
      />

      {/* Teacher Manual Review & Feedback Modal */}
      {selectedSubForFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border-2 border-[#1C2C5B] max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="border-b border-[#CBD5E1] pb-3">
              <span className="text-[11px] font-bold text-[#6CABDD] uppercase tracking-wider block">
                Teacher Review & Marks Adjustment
              </span>
              <h3 className="text-base font-bold text-[#1C2C5B]">
                {selectedSubForFeedback.learnerName} ({selectedSubForFeedback.learnerId})
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Assessment: {selectedSubForFeedback.quizTitle} • Max Marks: {selectedSubForFeedback.totalMarks}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1C2C5B] uppercase tracking-wider mb-1">
                  Adjust Raw Score (Max {selectedSubForFeedback.totalMarks})
                </label>
                <input
                  type="number"
                  min={0}
                  max={selectedSubForFeedback.totalMarks}
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  className="w-full border border-[#CBD5E1] p-2 text-xs font-semibold focus:outline-hidden focus:border-[#1C2C5B]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1C2C5B] uppercase tracking-wider mb-1">
                  Teacher Pedagogical Notes & Feedback
                </label>
                <textarea
                  rows={3}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Enter constructive praise, specific learning tips, or revision guidance for the student..."
                  className="w-full border border-[#CBD5E1] p-2 text-xs focus:outline-hidden focus:border-[#1C2C5B]"
                />
              </div>

              {selectedSubForFeedback.topicsToPractise && selectedSubForFeedback.topicsToPractise.length > 0 && (
                <div className="p-2.5 bg-[#F5F8FC] border border-[#CBD5E1]">
                  <span className="font-bold text-[#1C2C5B] block mb-1">Identified Focus Topics:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedSubForFeedback.topicsToPractise.map((t, i) => (
                      <span key={i} className="bg-white border border-[#CBD5E1] px-1.5 py-0.5 text-[10px] font-medium text-[#475569]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#CBD5E1]">
              <OutlineButton onClick={() => setSelectedSubForFeedback(null)}>
                Cancel
              </OutlineButton>
              <PrimaryButton onClick={handleSaveFeedback}>
                Save Feedback & Marks
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
