import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton, SecondaryButton } from '../../components/ui/Buttons';
import { InputField, SelectField } from '../../components/ui/FormControls';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { appDataStore } from '../../services/storage';
import { quizApiService } from '../../services/quiz-api';
import { Quiz, QuizStatus } from '../../types/quiz';
import {
  Plus,
  Sparkles,
  Search,
  Eye,
  Edit2,
  Copy,
  CheckCircle2,
  Lock,
  BarChart3,
  Filter,
  Trash2,
  AlertTriangle,
  Printer,
} from 'lucide-react';

export const TeacherQuizzesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'ALL';

  const [quizzes, setQuizzes] = useState<Quiz[]>(appDataStore.getQuizzes());
  const [subjects, setSubjects] = useState(appDataStore.getSubjects());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Dialogs
  const [publishingQuiz, setPublishingQuiz] = useState<Quiz | null>(null);
  const [closingQuiz, setClosingQuiz] = useState<Quiz | null>(null);
  const [deletingQuiz, setDeletingQuiz] = useState<Quiz | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    return appDataStore.subscribe(() => {
      setQuizzes(appDataStore.getQuizzes());
      setSubjects(appDataStore.getSubjects());
    });
  }, []);

  const handlePublish = async () => {
    if (publishingQuiz) {
      await quizApiService.publishQuiz(publishingQuiz.id);
      setPublishingQuiz(null);
    }
  };

  const handleClose = () => {
    if (closingQuiz) {
      appDataStore.updateQuizStatus(closingQuiz.id, 'closed');
      setClosingQuiz(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingQuiz) return;
    const existingSubs = appDataStore.getSubmissionsByQuiz(deletingQuiz.id);
    if (existingSubs.length > 0) {
      setDeleteError(`Cannot delete "${deletingQuiz.title}" because ${existingSubs.length} learner attempt(s) have already been recorded.`);
      return;
    }
    await quizApiService.deleteQuiz(deletingQuiz.id);
    setDeletingQuiz(null);
    setDeleteError(null);
  };

  const handleDuplicate = (quizId: string) => {
    const dup = appDataStore.duplicateQuiz(quizId);
    if (dup) {
      navigate(`/teacher/quizzes/${dup.id}`);
    }
  };

  // Filtered List
  const filtered = quizzes.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.topicsCovered.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSubject = selectedSubject === 'ALL' || q.subjectId === selectedSubject;
    const matchesGrade = selectedGrade === 'ALL' || q.grade === selectedGrade;

    let matchesTab = true;
    if (activeTab === 'drafts') matchesTab = q.status === 'draft';
    else if (activeTab === 'in_progress')
      matchesTab = q.status === 'in_progress' || q.status === 'published';
    else if (activeTab === 'closed') matchesTab = q.status === 'closed';
    else if (activeTab === 'results_released') matchesTab = q.status === 'results_released';

    return matchesSearch && matchesSubject && matchesGrade && matchesTab;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Registry & Quiz Management"
        subtitle="Create, publish, and control result releases for school assessments across all subjects."
        actions={
          <div className="flex gap-2">
            <OutlineButton
              onClick={() => navigate('/teacher/quizzes/new?mode=ai')}
              icon={<Sparkles size={14} className="text-[#1C2C5B]" />}
            >
              Generate with AI
            </OutlineButton>
            <PrimaryButton
              onClick={() => navigate('/teacher/quizzes/new')}
              icon={<Plus size={14} />}
            >
              Create New Quiz
            </PrimaryButton>
          </div>
        }
      />

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#CBD5E1] pb-3">
        {[
          { key: 'ALL', label: 'All Quizzes' },
          { key: 'drafts', label: 'Drafts' },
          { key: 'in_progress', label: 'Published / In Progress' },
          { key: 'closed', label: 'Closed (Awaiting Release)' },
          { key: 'results_released', label: 'Results Released' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
              activeTab === tab.key
                ? 'bg-[#1C2C5B] text-white border-[#1C2C5B]'
                : 'bg-white text-[#64748B] border-[#CBD5E1] hover:text-[#1C2C5B] hover:border-[#6CABDD]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#CBD5E1] p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <InputField
            type="text"
            placeholder="Search quizzes by title or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-[#64748B] uppercase">Subject:</span>
            <SelectField
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-xs py-1"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-[#64748B] uppercase">Grade:</span>
            <SelectField
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="text-xs py-1"
            >
              <option value="ALL">All Grades</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4">Grade 4</option>
              <option value="Grade 5">Grade 5</option>
              <option value="Grade 6">Grade 6</option>
            </SelectField>
          </div>

          <span className="text-xs text-[#64748B] font-medium border-l border-[#CBD5E1] pl-2.5">
            {filtered.length} Assessments
          </span>
        </div>
      </div>

      {/* Quizzes List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#CBD5E1] p-12 text-center shadow-xs">
          <h3 className="text-base font-bold text-[#1C2C5B]">No Quizzes Found</h3>
          <p className="text-xs text-[#64748B] mt-1 mb-4">
            Try adjusting your search query or status filter above.
          </p>
          <PrimaryButton onClick={() => navigate('/teacher/quizzes/new')} icon={<Plus size={14} />}>
            Create Assessment Now
          </PrimaryButton>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white border border-[#CBD5E1] p-5 shadow-xs hover:border-[#6CABDD] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#CBD5E1]/60">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6CABDD]">
                      {quiz.subjectName} • {quiz.className} ({quiz.grade})
                    </span>
                    <span className="text-[#CBD5E1]">•</span>
                    <span className="text-xs text-[#64748B] capitalize">{quiz.difficulty} Difficulty</span>
                  </div>
                  <h3 className="text-base font-bold text-[#1C2C5B]">{quiz.title}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {quiz.topicsCovered.map((topic, i) => (
                      <span
                        key={i}
                        className="bg-[#F5F8FC] text-[#475569] text-[10px] font-medium px-2 py-0.5 border border-[#CBD5E1]"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <StatusLabel status={quiz.status} />
                </div>
              </div>

              {/* Assessment Metrics & Quick Actions Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 mt-1 text-xs">
                <div className="flex flex-wrap items-center gap-4 text-[#64748B]">
                  <span>
                    Questions: <strong className="text-[#0F172A]">{quiz.questions.length}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Duration: <strong className="text-[#0F172A]">{quiz.durationMinutes}m</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Release Policy:{' '}
                    <strong className="text-[#1C2C5B] uppercase">{quiz.releasePolicy}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Offline Support:{' '}
                    <strong className="text-[#0F172A]">
                      {quiz.allowOffline ? 'Enabled (Cached)' : 'Online Only'}
                    </strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <OutlineButton
                    onClick={() => navigate(`/teacher/quizzes/${quiz.id}`)}
                    className="text-xs py-1 px-2.5"
                    icon={<Eye size={13} />}
                  >
                    View Details
                  </OutlineButton>

                  {quiz.status === 'draft' && (
                    <OutlineButton
                      onClick={() => navigate(`/teacher/quizzes/new?edit=${quiz.id}`)}
                      className="text-xs py-1 px-2.5"
                      icon={<Edit2 size={13} />}
                    >
                      Edit Draft
                    </OutlineButton>
                  )}

                  <OutlineButton
                    onClick={() => handleDuplicate(quiz.id)}
                    className="text-xs py-1 px-2.5"
                    icon={<Copy size={13} />}
                    title="Duplicate Quiz"
                  >
                    Duplicate
                  </OutlineButton>

                  <OutlineButton
                    onClick={() => navigate(`/teacher/quizzes/${quiz.id}/print`)}
                    className="text-xs py-1 px-2.5"
                    icon={<Printer size={13} />}
                    title="Print Paper / PDF"
                  >
                    Print
                  </OutlineButton>

                  {quiz.status === 'draft' && (
                    <PrimaryButton
                      onClick={() => setPublishingQuiz(quiz)}
                      className="text-xs py-1 px-2.5"
                      icon={<CheckCircle2 size={13} />}
                    >
                      Publish
                    </PrimaryButton>
                  )}

                  {(quiz.status === 'published' || quiz.status === 'in_progress') && (
                    <OutlineButton
                      onClick={() => setClosingQuiz(quiz)}
                      className="text-xs py-1 px-2.5 text-[#B45309] border-[#B45309]/30 hover:border-[#B45309]"
                      icon={<Lock size={13} />}
                    >
                      Close Assessment
                    </OutlineButton>
                  )}

                  {(quiz.status === 'closed' || quiz.status === 'results_released') && (
                    <PrimaryButton
                      onClick={() => navigate(`/teacher/results?quizId=${quiz.id}`)}
                      className="text-xs py-1 px-2.5"
                      icon={<BarChart3 size={13} />}
                    >
                      {quiz.status === 'closed' ? 'Release Results' : 'View Results'}
                    </PrimaryButton>
                  )}

                  {quiz.status === 'draft' && (
                    <OutlineButton
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingQuiz(quiz);
                      }}
                      className="text-xs py-1 px-2.5 text-[#DC2626] border-[#DC2626]/30 hover:border-[#DC2626]"
                      icon={<Trash2 size={13} />}
                      title="Delete Draft"
                    >
                      Delete
                    </OutlineButton>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish Confirmation */}
      <ConfirmDialog
        isOpen={!!publishingQuiz}
        title="Publish Assessment to Cohort"
        message={`Are you sure you want to publish "${publishingQuiz?.title}" to ${publishingQuiz?.className}? Once published, learners will be able to start the quiz and download it to their offline tablets.`}
        confirmLabel="Confirm Publication"
        onConfirm={handlePublish}
        onCancel={() => setPublishingQuiz(null)}
      />

      {/* Close Assessment Confirmation */}
      <ConfirmDialog
        isOpen={!!closingQuiz}
        title="Close Assessment"
        message={`Close "${closingQuiz?.title}"? Learners will no longer be able to submit new attempts. You will then be able to review submissions and release marksheets.`}
        confirmLabel="Close Assessment"
        onConfirm={handleClose}
        onCancel={() => setClosingQuiz(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingQuiz}
        title={deleteError ? 'Cannot Delete Assessment' : 'Delete Assessment Draft'}
        message={
          deleteError
            ? deleteError
            : `Are you sure you want to permanently delete draft "${deletingQuiz?.title}"? This action cannot be undone.`
        }
        confirmLabel={deleteError ? 'Close' : 'Confirm Deletion'}
        isDestructive={!deleteError}
        onConfirm={deleteError ? () => { setDeletingQuiz(null); setDeleteError(null); } : handleDelete}
        onCancel={() => { setDeletingQuiz(null); setDeleteError(null); }}
      />
    </div>
  );
};
