import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { PrimaryButton, OutlineButton, SecondaryButton } from '../../components/ui/Buttons';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { appDataStore } from '../../services/storage';
import { quizApiService } from '../../services/quiz-api';
import { networkManager } from '../../lib/network';
import {
  saveActiveAnswers,
  getActiveAnswers,
  clearActiveAnswers,
  queueOfflineSubmission,
  getCachedQuizById,
} from '../../lib/offline-db';
import { Quiz, Question } from '../../types/quiz';
import { Submission, AnswerRecord } from '../../types/submission';
import {
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Save,
  AlertCircle,
  HelpCircle,
  FileCheck,
} from 'lucide-react';

export const LearnerQuizPlayer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isOnline, setIsOnline] = useState<boolean>(networkManager.isOnline());
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load quiz from store or IndexedDB offline cache
  useEffect(() => {
    async function loadQuizData() {
      if (!id) return;
      let q = appDataStore.getQuizById(id);
      if (!q) {
        // Fallback to offline cached quiz
        const cached = await getCachedQuizById(id);
        if (cached) q = cached;
      }
      setQuiz(q || null);

      // Restore active draft answers from IndexedDB (survives page refresh!)
      if (user?.learnerId) {
        const savedDraft = await getActiveAnswers(id, user.learnerId);
        if (savedDraft && savedDraft.answers) {
          setAnswers(savedDraft.answers);
          if (typeof savedDraft.currentQuestionIndex === 'number') {
            setCurrentIdx(savedDraft.currentQuestionIndex);
          }
        }
      }
    }

    loadQuizData();

    const unsubNet = networkManager.subscribe((status) => {
      setIsOnline(status);
    });

    return () => unsubNet();
  }, [id, user]);

  if (!quiz) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white border border-[#CBD5E1] p-8 text-center shadow-xs">
        <h2 className="text-lg font-bold text-[#1C2C5B]">Quiz Not Found</h2>
        <p className="text-xs text-[#64748B] mt-1 mb-4">
          This assessment is not available in local cache or has not been assigned.
        </p>
        <OutlineButton onClick={() => navigate('/learner/dashboard')}>
          Return to Dashboard
        </OutlineButton>
      </div>
    );
  }

  const currentQuestion: Question = quiz.questions[currentIdx] || quiz.questions[0];
  const totalQuestions = quiz.questions.length;
  const answeredCount = Object.keys(answers).filter((k) => !!answers[k]?.trim()).length;

  // Real-time answer persistence to IndexedDB
  const handleSelectAnswer = async (response: string) => {
    const updated = {
      ...answers,
      [currentQuestion.id]: response,
    };
    setAnswers(updated);
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    if (user?.learnerId && id) {
      await saveActiveAnswers(id, user.learnerId, updated, currentIdx);
    }
  };

  const handleNext = async () => {
    if (currentIdx < totalQuestions - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      if (user?.learnerId && id) {
        await saveActiveAnswers(id, user.learnerId, answers, nextIdx);
      }
    } else {
      setIsReviewOpen(true);
    }
  };

  const handlePrev = async () => {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      if (user?.learnerId && id) {
        await saveActiveAnswers(id, user.learnerId, answers, prevIdx);
      }
    }
  };

  // Automated objective scoring
  const calculateMarks = () => {
    let earned = 0;
    let total = 0;
    const answerDetails: AnswerRecord[] = [];
    const topicsFailed: Set<string> = new Set();

    quiz.questions.forEach((q) => {
      total += q.marks;
      const resp = answers[q.id]?.trim() || '';
      let isCorrect = false;

      if (q.type === 'multiple_choice') {
        isCorrect = resp === q.correctAnswer;
      } else if (q.type === 'true_false') {
        isCorrect = resp.toLowerCase() === q.correctAnswer.toLowerCase();
      } else if (q.type === 'short_answer') {
        isCorrect = resp.toLowerCase() === q.correctAnswer.trim().toLowerCase();
      }

      if (isCorrect) {
        earned += q.marks;
      } else if (q.topic) {
        topicsFailed.add(q.topic);
      }

      answerDetails.push({
        questionId: q.id,
        response: resp,
        isCorrect,
        marksAwarded: isCorrect ? q.marks : 0,
        maxMarks: q.marks,
      });
    });

    const percentage = total > 0 ? Math.round((earned / total) * 100) : 0;
    return { earned, total, percentage, answerDetails, topicsToPractise: Array.from(topicsFailed) };
  };

  // Submit assessment (handles online vs offline queue)
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    const { earned, total, percentage, answerDetails, topicsToPractise } = calculateMarks();
    const submissionId = `sub-${Date.now()}-${user?.learnerId || 'anon'}`;
    const clientHash = `hash-${quiz.id}-${user?.learnerId || 'anon'}-${Date.now()}`;
    const isAutoRelease = quiz.releasePolicy === 'automatic' || quiz.status === 'results_released';
    const submissionStatus = isOnline
      ? (isAutoRelease ? 'marked' : 'submitted')
      : 'saved_offline';

    const submissionRecord: Submission = {
      id: submissionId,
      quizId: quiz.id,
      quizTitle: quiz.title,
      subjectName: quiz.subjectName,
      learnerId: user?.learnerId || '',
      learnerName: user?.name || '',
      classId: quiz.classId,
      className: quiz.className,
      answers,
      answerDetails,
      score: earned,
      totalMarks: total,
      percentage,
      status: submissionStatus,
      syncStatus: isOnline ? 'synced' : 'offline_queued',
      isOfflineSubmission: !isOnline,
      submittedAt: new Date().toISOString(),
      syncedAt: isOnline ? new Date().toISOString() : undefined,
      topicsToPractise,
      clientSubmissionHash: clientHash,
    };

    if (isOnline) {
      // Direct live submission to local store & backend API
      appDataStore.saveSubmission(submissionRecord);
      try {
        await quizApiService.submitQuiz(quiz.id, answers, clientHash, false);
      } catch (err) {
        console.warn('[Server Live Submission Sync]', err);
      }
    } else {
      // Durable IndexedDB Queue for Offline Sync!
      await queueOfflineSubmission(submissionRecord);
    }

    // Clear active in-progress draft from IndexedDB
    if (user?.learnerId && id) {
      await clearActiveAnswers(id, user.learnerId);
    }

    setIsSubmitting(false);
    setIsConfirmSubmitOpen(false);
    setIsReviewOpen(false);

    // Redirect to honest confirmation screen
    navigate(
      `/learner/submitted?quizTitle=${encodeURIComponent(quiz.title)}&offline=${!isOnline}&id=${submissionId}`
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 py-2">
      {/* Quiz Header Bar */}
      <div className="bg-white border border-[#CBD5E1] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold text-[#6CABDD] uppercase tracking-wider block">
            {quiz.subjectName} Assessment
          </span>
          <h1 className="text-base font-bold text-[#1C2C5B]">{quiz.title}</h1>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          {/* Connection Status Badge */}
          {isOnline ? (
            <span className="flex items-center gap-1 text-[#1C2C5B] bg-[#E8F3FC] px-2.5 py-1 border border-[#6CABDD]/40">
              <Wifi size={13} className="text-[#6CABDD]" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#92400E] bg-[#FEF3C7] px-2.5 py-1 border border-[#F59E0B]/40 font-bold">
              <WifiOff size={13} /> Offline Mode Active
            </span>
          )}

          {/* Autosave Status */}
          <span className="flex items-center gap-1 text-[#64748B]">
            <Save size={13} />
            <span>Saved: {lastSavedTime}</span>
          </span>
        </div>
      </div>

      {/* Progress Bar (Strictly Sky Blue, No Green) */}
      <div className="bg-white border border-[#CBD5E1] p-3 shadow-xs">
        <div className="flex justify-between items-center text-xs font-semibold text-[#1C2C5B] mb-1.5">
          <span>
            Question {currentIdx + 1} of {totalQuestions}
          </span>
          <span>
            {answeredCount} of {totalQuestions} Answered
          </span>
        </div>
        <div className="w-full bg-[#E8F3FC] h-2.5 overflow-hidden">
          <div
            className="bg-[#6CABDD] h-full transition-all duration-200"
            style={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Taking Area */}
      <div className="bg-white border border-[#CBD5E1] p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] block mb-1">
            Question #{currentIdx + 1} • {currentQuestion.marks} {currentQuestion.marks === 1 ? 'Mark' : 'Marks'}
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] leading-relaxed">
            {currentQuestion.prompt}
          </h2>
        </div>

        {/* Answer Options — Multiple Choice (Large Touch Targets for Tablets) */}
        {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const isSelected = answers[currentQuestion.id] === option.id;
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => handleSelectAnswer(option.id)}
                  className={`w-full text-left p-4 sm:p-5 border text-sm sm:text-base font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#1C2C5B] text-white border-[#1C2C5B] font-semibold'
                      : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F5F8FC] hover:border-[#6CABDD]'
                  }`}
                >
                  <span>{option.text}</span>
                  <div
                    className={`w-5 h-5 border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-white bg-[#6CABDD]' : 'border-[#CBD5E1] bg-white'
                    }`}
                  >
                    {isSelected && <span className="w-2 h-2 bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Answer Options — True / False */}
        {currentQuestion.type === 'true_false' && (
          <div className="grid grid-cols-2 gap-4">
            {['true', 'false'].map((val) => {
              const isSelected = answers[currentQuestion.id] === val;
              return (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleSelectAnswer(val)}
                  className={`p-6 border text-base sm:text-lg font-bold text-center uppercase tracking-wider transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1C2C5B] text-white border-[#1C2C5B]'
                      : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F5F8FC] hover:border-[#6CABDD]'
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        )}

        {/* Answer Options — Short Answer */}
        {currentQuestion.type === 'short_answer' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#1C2C5B]">
              Type Your Answer Below
            </label>
            <input
              type="text"
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleSelectAnswer(e.target.value)}
              placeholder="e.g. 1/4"
              className="w-full px-4 py-3 text-base bg-white text-[#0F172A] border border-[#CBD5E1] focus:outline-hidden focus:border-[#6CABDD] focus:ring-1 focus:ring-[#6CABDD]"
            />
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between bg-white border border-[#CBD5E1] p-4 shadow-xs">
        <OutlineButton
          onClick={handlePrev}
          disabled={currentIdx === 0}
          icon={<ArrowLeft size={16} />}
          className="text-xs uppercase font-bold py-2.5 px-4"
        >
          Previous
        </OutlineButton>

        <div className="flex items-center gap-2">
          <OutlineButton
            onClick={() => setIsReviewOpen(true)}
            className="text-xs uppercase font-bold py-2.5 px-3"
          >
            Review ({answeredCount}/{totalQuestions})
          </OutlineButton>

          {currentIdx < totalQuestions - 1 ? (
            <PrimaryButton
              onClick={handleNext}
              className="text-xs uppercase font-bold py-2.5 px-5"
            >
              Next <ArrowRight size={16} className="ml-1 inline" />
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={() => setIsReviewOpen(true)}
              className="text-xs uppercase font-bold py-2.5 px-5"
              icon={<CheckCircle2 size={16} />}
            >
              Submit Quiz
            </PrimaryButton>
          )}
        </div>
      </div>

      {/* Question Navigation Matrix Panel */}
      <div className="bg-white border border-[#CBD5E1] p-4 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block mb-2">
          Question Navigator
        </span>
        <div className="flex flex-wrap gap-2">
          {quiz.questions.map((q, idx) => {
            const isAnswered = !!answers[q.id]?.trim();
            const isCurrent = currentIdx === idx;
            return (
              <button
                type="button"
                key={q.id}
                onClick={() => setCurrentIdx(idx)}
                className={`w-9 h-9 text-xs font-bold border transition-colors cursor-pointer ${
                  isCurrent
                    ? 'border-[#1C2C5B] bg-[#1C2C5B] text-white ring-2 ring-[#6CABDD]'
                    : isAnswered
                    ? 'border-[#6CABDD] bg-[#E8F3FC] text-[#1C2C5B]'
                    : 'border-[#CBD5E1] bg-white text-[#64748B] hover:border-[#6CABDD]'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Review Dialog before final submission */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs">
          <div className="bg-white border border-[#CBD5E1] shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[#1C2C5B] uppercase tracking-wider pb-2 border-b border-[#CBD5E1]">
              Submission Summary Check
            </h3>
            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/50">
                <span className="text-[#64748B]">Assessment Title:</span>
                <span className="font-bold text-[#0F172A]">{quiz.title}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/50">
                <span className="text-[#64748B]">Answered Questions:</span>
                <span className="font-bold text-[#1C2C5B]">
                  {answeredCount} of {totalQuestions}
                </span>
              </div>
              {totalQuestions - answeredCount > 0 && (
                <div className="p-3 bg-[#FEF3C7] border border-[#F59E0B]/40 text-[#92400E]">
                  You still have {totalQuestions - answeredCount} unanswered question{totalQuestions - answeredCount === 1 ? '' : 's'}. You can go back and complete them before submitting.
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/50">
                <span className="text-[#64748B]">Connection State:</span>
                <span className="font-semibold text-[#0F172A]">
                  {isOnline ? 'Connected (Syncs Instantly)' : 'Offline (Queued on Tablet)'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#CBD5E1]">
              <OutlineButton onClick={() => setIsReviewOpen(false)}>
                Return to Quiz
              </OutlineButton>
              <PrimaryButton
                onClick={() => {
                  setIsReviewOpen(false);
                  setIsConfirmSubmitOpen(true);
                }}
              >
                Proceed to Submit
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Final Submission Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmSubmitOpen}
        title="Finalize Assessment Submission"
        message={
          isOnline
            ? "Are you ready to submit your answers? Once submitted, your answers will be recorded on the school server and your teacher will release marks after review."
            : "You are currently offline. Your answers will be safely saved on this tablet and will automatically synchronize with your teacher as soon as Wi-Fi reconnects. Submit now?"
        }
        confirmLabel="Yes, Submit Assessment"
        onConfirm={handleFinalSubmit}
        onCancel={() => setIsConfirmSubmitOpen(false)}
      />
    </div>
  );
};
