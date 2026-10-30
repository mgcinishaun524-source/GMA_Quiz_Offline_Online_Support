import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton, SecondaryButton } from '../../components/ui/Buttons';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { appDataStore } from '../../services/storage';
import { quizApiService } from '../../services/quiz-api';
import { Quiz } from '../../types/quiz';
import { Submission } from '../../types/submission';
import {
  HelpCircle,
  Clock,
  Layers,
  BookOpen,
  Copy,
  BarChart3,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Wifi,
  Users,
  Edit2,
  Trash2,
  Printer,
  FileText,
} from 'lucide-react';

export const TeacherQuizDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | undefined>(appDataStore.getQuizById(id || ''));
  const [submissions, setSubmissions] = useState<Submission[]>(
    appDataStore.getSubmissionsByQuiz(id || '')
  );

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    return appDataStore.subscribe(() => {
      if (id) {
        setQuiz(appDataStore.getQuizById(id));
        setSubmissions(appDataStore.getSubmissionsByQuiz(id));
      }
    });
  }, [id]);

  if (!quiz) {
    return (
      <div className="bg-white border border-[#CBD5E1] p-10 text-center">
        <h3 className="text-base font-bold text-[#1C2C5B]">Assessment Not Found</h3>
        <p className="text-xs text-[#64748B] mt-1 mb-4">The requested quiz ID does not exist in local registry.</p>
        <OutlineButton onClick={() => navigate('/teacher/quizzes')}>
          Return to Quizzes
        </OutlineButton>
      </div>
    );
  }

  const handleCloseAssessment = () => {
    appDataStore.updateQuizStatus(quiz.id, 'closed');
    setIsCloseModalOpen(false);
  };

  const handlePublishAssessment = async () => {
    await quizApiService.publishQuiz(quiz.id);
    setIsPublishModalOpen(false);
  };

  const handleDeleteAssessment = async () => {
    const existing = appDataStore.getSubmissionsByQuiz(quiz.id);
    if (existing.length > 0) {
      setDeleteError(`Cannot delete "${quiz.title}" because ${existing.length} learner submission(s) have been recorded.`);
      return;
    }
    await quizApiService.deleteQuiz(quiz.id);
    navigate('/teacher/quizzes');
  };

  const handleDuplicate = () => {
    const dup = appDataStore.duplicateQuiz(quiz.id);
    if (dup) {
      navigate(`/teacher/quizzes/${dup.id}`);
    }
  };

  const offlineSubmissionsCount = submissions.filter((s) => s.isOfflineSubmission).length;
  const onlineSubmissionsCount = submissions.length - offlineSubmissionsCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title={quiz.title}
        subtitle={`${quiz.subjectName} • ${quiz.className} (${quiz.grade})`}
        breadcrumbs={[
          { label: 'Teacher Workspace', href: '/teacher/dashboard' },
          { label: 'Quizzes', href: '/teacher/quizzes' },
          { label: quiz.title },
        ]}
        badge={<StatusLabel status={quiz.status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <OutlineButton onClick={() => navigate('/teacher/quizzes')} icon={<ArrowLeft size={13} />}>
              Back
            </OutlineButton>
            {quiz.status === 'draft' && (
              <>
                <OutlineButton
                  onClick={() => navigate(`/teacher/quizzes/new?edit=${quiz.id}`)}
                  icon={<Edit2 size={13} />}
                >
                  Edit Draft
                </OutlineButton>
                <OutlineButton
                  onClick={() => { setDeleteError(null); setIsDeleteModalOpen(true); }}
                  icon={<Trash2 size={13} />}
                  className="text-[#DC2626] border-[#DC2626]/30 hover:border-[#DC2626]"
                >
                  Delete Draft
                </OutlineButton>
              </>
            )}
            <OutlineButton onClick={handleDuplicate} icon={<Copy size={13} />}>
              Duplicate
            </OutlineButton>
            <OutlineButton
              onClick={() => navigate(`/teacher/quizzes/${quiz.id}/print`)}
              icon={<Printer size={13} />}
            >
              Print Paper
            </OutlineButton>
            <OutlineButton
              onClick={() => navigate(`/teacher/quizzes/${quiz.id}/print?mode=answer_key`)}
              icon={<FileText size={13} />}
            >
              Answer Key
            </OutlineButton>
            {quiz.status === 'draft' && (
              <PrimaryButton onClick={() => setIsPublishModalOpen(true)} icon={<CheckCircle2 size={13} />}>
                Publish to Cohort
              </PrimaryButton>
            )}
            {(quiz.status === 'published' || quiz.status === 'in_progress') && (
              <OutlineButton
                onClick={() => setIsCloseModalOpen(true)}
                icon={<Lock size={13} />}
                className="text-[#B45309] border-[#B45309]/30"
              >
                Close Assessment
              </OutlineButton>
            )}
            <PrimaryButton
              onClick={() => navigate(`/teacher/results?quizId=${quiz.id}`)}
              icon={<BarChart3 size={13} />}
            >
              {quiz.status === 'closed' ? 'Review & Release Marks' : 'View Submissions'}
            </PrimaryButton>
          </div>
        }
      />

      {/* Metadata Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#CBD5E1] p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
            Submissions Received
          </span>
          <div className="text-2xl font-extrabold text-[#1C2C5B] mt-1">{submissions.length}</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            {offlineSubmissionsCount} offline queued / {onlineSubmissionsCount} direct
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
            Question Count & Marks
          </span>
          <div className="text-2xl font-extrabold text-[#1C2C5B] mt-1">
            {quiz.questions.length} Items
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            {quiz.questions.reduce((sum, q) => sum + q.marks, 0)} Total Marks Available
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
            Result Release Policy
          </span>
          <div className="text-2xl font-extrabold text-[#1C2C5B] mt-1 uppercase">
            {quiz.releasePolicy}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            {quiz.status === 'results_released' ? 'Marks visible to students' : 'Marks hidden from students'}
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
            Tablet Offline Caching
          </span>
          <div className="text-2xl font-extrabold text-[#1C2C5B] mt-1">
            {quiz.allowOffline ? 'Enabled' : 'Disabled'}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            {quiz.allowOffline ? 'Stored in IndexedDB on tablet' : 'Enforces active Wi-Fi'}
          </div>
        </div>
      </div>

      {/* Assessment Question Content */}
      <div className="bg-white border border-[#CBD5E1] p-6 shadow-xs space-y-6">
        <div className="pb-3 border-b border-[#CBD5E1] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
              Assessment Question Content ({quiz.questions.length} Questions)
            </h3>
            <p className="text-xs text-[#64748B]">
              Objective questions marked automatically; short answer graded by exact match or teacher review
            </p>
          </div>
          <div className="flex gap-1.5">
            {quiz.topicsCovered.map((t, idx) => (
              <span
                key={idx}
                className="bg-[#E8F3FC] text-[#1C2C5B] text-[10px] font-semibold px-2 py-0.5 border border-[#6CABDD]/30"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {quiz.questions.map((q, idx) => (
            <div key={q.id} className="p-4 bg-[#F5F8FC] border border-[#CBD5E1] space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-[#CBD5E1]/60">
                <span className="font-bold text-[#1C2C5B]">
                  Question #{idx + 1} ({q.type.replace('_', ' ').toUpperCase()})
                </span>
                <span className="font-semibold text-[#64748B]">{q.marks} Marks • Topic: {q.topic}</span>
              </div>
              <p className="text-sm font-semibold text-[#0F172A]">{q.prompt}</p>

              {q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`p-2 border ${
                        q.correctAnswer === opt.id
                          ? 'bg-[#E8F3FC] border-[#1C2C5B] font-bold text-[#1C2C5B]'
                          : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                      }`}
                    >
                      <span>{opt.text}</span>
                      {q.correctAnswer === opt.id && (
                        <span className="ml-2 text-[10px] text-[#6CABDD] font-bold uppercase">
                          (Correct Key)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'true_false' && (
                <div className="p-2 bg-white border border-[#CBD5E1] inline-block font-bold text-[#1C2C5B]">
                  Correct Answer: {q.correctAnswer.toUpperCase()}
                </div>
              )}

              {q.type === 'short_answer' && (
                <div className="p-2 bg-white border border-[#CBD5E1] inline-block font-mono text-[#1C2C5B]">
                  Accepted Key: "{q.correctAnswer}"
                </div>
              )}

              {q.explanation && (
                <p className="text-[11px] text-[#64748B] pt-1">
                  <strong>Explanation:</strong> {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Confirm Close */}
      <ConfirmDialog
        isOpen={isCloseModalOpen}
        title="Close Active Assessment"
        message="Closing this quiz will stop learners from submitting new attempts. You will then be able to review the submissions and release marksheets."
        confirmLabel="Close Assessment"
        onConfirm={handleCloseAssessment}
        onCancel={() => setIsCloseModalOpen(false)}
      />

      {/* Confirm Publish */}
      <ConfirmDialog
        isOpen={isPublishModalOpen}
        title="Publish Assessment"
        message={`Publish "${quiz.title}" to ${quiz.className}? Learners will immediately be able to take the quiz online or download it to school tablets.`}
        confirmLabel="Publish to Cohort"
        onConfirm={handlePublishAssessment}
        onCancel={() => setIsPublishModalOpen(false)}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        title={deleteError ? 'Cannot Delete Assessment' : 'Delete Draft Assessment'}
        message={
          deleteError
            ? deleteError
            : `Are you sure you want to delete draft "${quiz.title}"? This action cannot be undone.`
        }
        confirmLabel={deleteError ? 'Close' : 'Confirm Deletion'}
        isDestructive={!deleteError}
        onConfirm={deleteError ? () => { setIsDeleteModalOpen(false); setDeleteError(null); } : handleDeleteAssessment}
        onCancel={() => { setIsDeleteModalOpen(false); setDeleteError(null); }}
      />
    </div>
  );
};
