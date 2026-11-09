import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { PrimaryButton, OutlineButton, SecondaryButton } from '../../components/ui/Buttons';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { appDataStore } from '../../services/storage';
import { quizApiService, SubmissionRejectedError } from '../../services/quiz-api';
import { submissionReceiptStore } from '../../services/submission-receipt';
import type { ReceiptStatus } from '../../services/submission-receipt';
import { networkManager } from '../../lib/network';
import {
  saveActiveAnswers,
  getActiveAnswers,
  clearActiveAnswers,
  queueOfflineSubmission,
  getCachedQuizById,
} from '../../lib/offline-db';
import { Quiz, Question } from '../../types/quiz';
import { Submission } from '../../types/submission';
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
  Maximize2,
  ShieldAlert,
} from 'lucide-react';

// Human-readable countdown, e.g. "09:41" or "1:29:58".
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// Under five minutes the clock turns red and the learner gets a warning band.
const LOW_TIME_THRESHOLD_MS = 5 * 60 * 1000;

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

  // --- Server-owned timed sitting -----------------------------------------
  // `deadlineAt` comes from the server (POST /api/quizzes/:id/start). It is the
  // single authority for the hard cutoff: refreshing the page or reopening the
  // tab returns the SAME deadline, so no amount of reloading buys extra time.
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [startNonce, setStartNonce] = useState<number>(0);
  const [gateOpen, setGateOpen] = useState<boolean>(true);
  const [monitoring, setMonitoring] = useState<boolean>(false);

  // Refs that survive re-renders so the interval / listeners always act on the
  // latest state without re-subscribing.
  const submittedRef = useRef<boolean>(false);
  const violationHandledRef = useRef<boolean>(false);
  const finalizeRef = useRef<(integrityReason?: string) => void>(() => {});

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

  // Open (or resume) the server-owned clock. Timed exams are online-only: with
  // no server the clock cannot be enforced, so we refuse to start rather than
  // hand out a timer the learner could simply outwait.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function startAttempt() {
      setStartError(null);
      if (!networkManager.isOnline()) {
        setStartError(
          'This timed assessment can only be taken online. Reconnect to the school network, then tap Retry to begin.'
        );
        return;
      }
      try {
        const result = await quizApiService.startTimedAttempt(id as string);
        if (cancelled) return;
        // Trust the server's clock over the device clock: the offset neutralises
        // a deliberately wrong system time on the tablet.
        const offset = Date.parse(result.serverTime) - Date.now();
        setServerOffsetMs(Number.isFinite(offset) ? offset : 0);
        setDeadlineAt(result.attempt.deadlineAt);
      } catch (err) {
        if (cancelled) return;
        setStartError(
          err instanceof Error ? err.message : 'Unable to start this timed assessment.'
        );
      }
    }

    startAttempt();
    return () => {
      cancelled = true;
    };
  }, [id, startNonce]);

  // Countdown. Uses the server-corrected now so a tampered device clock cannot
  // extend the exam. At zero the paper is collected automatically — answered or
  // not — exactly like an invigilated final.
  useEffect(() => {
    if (!deadlineAt) return;

    const tick = () => {
      if (submittedRef.current) return;
      const remaining = Date.parse(deadlineAt) - (Date.now() + serverOffsetMs);
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        void finalizeRef.current('time_expired');
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [deadlineAt, serverOffsetMs]);

  // Integrity monitoring. The page can only perceive itself, so these are the
  // detectable "left the exam" signals: the tab being hidden, the window losing
  // focus, and picture-in-picture video starting. Per the exam policy the first
  // occurrence ends the sitting immediately and flags the record for review.
  useEffect(() => {
    if (!monitoring) return;

    const trigger = (reason: string) => {
      if (submittedRef.current || violationHandledRef.current) return;
      violationHandledRef.current = true;
      void finalizeRef.current(reason);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') trigger('tab_hidden');
    };
    const onBlur = () => trigger('window_blur');
    const onEnterPip = () => trigger('pip');

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('enterpictureinpicture', onEnterPip, true);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('enterpictureinpicture', onEnterPip, true);
    };
  }, [monitoring]);

  // Best-effort fullscreen on open; browsers require a user gesture, so the
  // gate overlay also offers one. A refused fullscreen still runs & monitors.
  useEffect(() => {
    if (!quiz) return;
    const el = document.documentElement as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
    };
    el.requestFullscreen?.().catch(() => {
      /* needs a gesture — the gate's tap provides it */
    });
  }, [quiz]);

  if (!quiz) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white border border-[#CBD5E1] p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-[#0B1F4B]">Quiz Not Found</h2>
        <p className="text-xs text-[#64748B] mt-1 mb-4">
          This assessment is not available in local cache or has not been assigned.
        </p>
        <OutlineButton onClick={() => navigate('/learner/dashboard')}>
          Return to Dashboard
        </OutlineButton>
      </div>
    );
  }

  // Timed exams cannot start without a server-owned clock.
  if (startError) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-[#EF4444]/40 p-8 text-center shadow-sm space-y-4">
        <div className="w-14 h-14 mx-auto flex items-center justify-center border border-[#EF4444] bg-[#FEF2F2] text-[#991B1B]">
          <AlertCircle size={28} />
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#D6A21E] block mb-1">
            {quiz.subjectName} Assessment
          </span>
          <h2 className="text-lg font-bold text-[#0B1F4B]">Cannot Start Assessment</h2>
          <p className="text-xs text-[#64748B] mt-2">{startError}</p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <PrimaryButton onClick={() => setStartNonce((n) => n + 1)}>Retry</PrimaryButton>
          <OutlineButton onClick={() => navigate('/learner/dashboard')}>
            Return to Dashboard
          </OutlineButton>
        </div>
      </div>
    );
  }

  const currentQuestion: Question = quiz.questions[currentIdx] || quiz.questions[0];
  const totalQuestions = quiz.questions.length;
  const answeredCount = Object.keys(answers).filter((k) => !!answers[k]?.trim()).length;

  const timeLeftSeconds = timeLeftMs === null ? null : Math.max(0, Math.ceil(timeLeftMs / 1000));
  const isLowTime = timeLeftMs !== null && timeLeftMs <= LOW_TIME_THRESHOLD_MS;

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

  // Submit the assessment (handles the timed cutoff, integrity violations,
  // online submission and the offline queue).
  //
  // The learner is sent to the receipt screen the instant the attempt ends, and
  // the network work runs in the background, flipping the receipt to the honest
  // outcome (saved / offline / rejected / terminated). This keeps the tap
  // feeling immediate without ever fabricating a success.
  //
  // `integrityReason` is supplied when the attempt was ended by the clock
  // ('time_expired') or by an integrity signal ('tab_hidden', 'window_blur',
  // 'pip'). The server stamps the record accordingly and flags it for review.
  const handleFinalSubmit = async (integrityReason?: string) => {
    if (submittedRef.current) return; // A second click while the first is in flight.
    submittedRef.current = true;
    setIsSubmitting(true);
    setMonitoring(false);

    const isTerminated = !!integrityReason && integrityReason !== 'time_expired';
    const timedOut = integrityReason === 'time_expired';
    const timeUpNote = 'Time expired — your paper was collected automatically.';

    const submissionId = `sub-${Date.now()}-${user?.learnerId || 'anon'}`;
    const clientHash = `hash-${quiz.id}-${user?.learnerId || 'anon'}-${Date.now()}`;

    const setReceipt = (status: ReceiptStatus, error?: string, note?: string) =>
      submissionReceiptStore.set({
        submissionId,
        quizId: quiz.id,
        quizTitle: quiz.title,
        status,
        error,
        note,
      });

    // Show the receipt immediately and confirm with the server in the background.
    if (isTerminated) {
      setReceipt(
        'terminated',
        integrityReason === 'pip'
          ? 'This attempt was ended because a floating (picture-in-picture) video was detected.'
          : 'This attempt was ended because another window or tab was opened during the assessment.'
      );
    } else {
      setReceipt('saving', undefined, timedOut ? timeUpNote : undefined);
    }

    setIsConfirmSubmitOpen(false);
    setIsReviewOpen(false);
    setGateOpen(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* exiting fullscreen is best-effort */
    }
    navigate(
      `/learner/submitted?quizTitle=${encodeURIComponent(quiz.title)}&id=${submissionId}`
    );

    let queuedOffline = !isOnline;

    const createQueuedRecord = (): Submission => ({
      id: submissionId,
      quizId: quiz.id,
      quizTitle: quiz.title,
      subjectName: quiz.subjectName,
      learnerId: user?.learnerId || '',
      learnerName: user?.name || '',
      classId: quiz.classId,
      className: quiz.className,
      answers,
      score: 0,
      totalMarks: quiz.questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0),
      percentage: 0,
      status: 'saved_offline',
      syncStatus: 'offline_queued',
      isOfflineSubmission: true,
      submittedAt: new Date().toISOString(),
      clientSubmissionHash: clientHash,
      terminationReason: integrityReason,
      isFlagged: isTerminated,
    });

    try {
      if (isOnline) {
        // Server-authoritative marking: the backend computes the score against
        // the author answer key and returns the authoritative submission (with
        // marks withheld until the teacher releases results). The learner device
        // never holds the answer key, so a locally-computed score would always be
        // a fabricated 0% — we must never persist one.
        await quizApiService.submitQuiz(quiz.id, answers, clientHash, false, integrityReason);
      } else {
        await queueOfflineSubmission(createQueuedRecord());
      }
    } catch (err) {
      if (err instanceof SubmissionRejectedError) {
        // The server answered and refused the attempt (deadline passed, attempt
        // limit reached, wrong class…). That is a real result: surface it on the
        // receipt and keep the learner's draft so nothing is lost. Never queue it
        // as if it had been accepted, which would make a rejected attempt look
        // submitted.
        if (isTerminated) {
          setReceipt('terminated', err.message);
        } else {
          setReceipt('rejected', err.message);
        }
        return;
      }
      // Otherwise the server could not be reached (offline, timeout, gateway
      // failure). Keep the answers in the durable queue and retry later.
      try {
        await queueOfflineSubmission(createQueuedRecord());
        queuedOffline = true;
      } catch (queueErr) {
        console.error('[Offline Queue] Failed to persist the attempt.', queueErr);
        setReceipt(
          'rejected',
          'Your answers could not be saved on this device. Please tell your teacher.'
        );
        return;
      }
    }

    // A terminated attempt keeps its terminated receipt even though the flagged
    // record reached the server — the learner must not see it as "submitted".
    if (isTerminated) return;

    // Reached only when the attempt was accepted or durably queued: the draft is
    // no longer needed.
    setReceipt(queuedOffline ? 'offline' : 'saved', undefined, timedOut ? timeUpNote : undefined);
    if (user?.learnerId && id) {
      void clearActiveAnswers(id, user.learnerId).catch((err) => {
        console.warn('[Quiz Draft] Could not clear the submitted draft.', err);
      });
    }
  };

  // Keep the ref pointing at the latest closure so the countdown and the
  // integrity listeners always submit the current answers.
  finalizeRef.current = handleFinalSubmit;

  const enterExamMode = async () => {
    try {
      const el = document.documentElement as HTMLElement & {
        requestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen && !document.fullscreenElement) {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen refused or unavailable — the exam still runs and is monitored.
    }
    setGateOpen(false);
    // Monitoring is armed only once the learner is actually in exam mode, and
    // after a short settle, so the fullscreen transition itself can never be
    // mistaken for the learner leaving the assessment.
    window.setTimeout(() => setMonitoring(true), 800);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 py-2">
      {/* Exam-mode gate: the tap that grants fullscreen. The clock is already
          running behind it, exactly like a paper handed out at the bell. */}
      {gateOpen && !isSubmitting && (
        <div className="fixed inset-0 z-[60] bg-[#0B1F4B] text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="w-16 h-16 mx-auto flex items-center justify-center border border-[#D6A21E] bg-[#0B1F4B] text-[#D6A21E]">
              <ShieldAlert size={32} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#D6A21E] block mb-2">
                Supervised Assessment
              </span>
              <h2 className="text-2xl font-extrabold">{quiz.title}</h2>
              <p className="text-sm text-white/70 mt-2">
                {quiz.durationMinutes} minute time limit. The clock starts now and cannot be paused.
              </p>
            </div>
            <div className="text-left text-xs bg-white/5 border border-white/15 p-4 space-y-2 text-white/80">
              <p className="font-bold text-[#D6A21E] uppercase tracking-wider text-[11px]">
                Exam Rules
              </p>
              <p>• Your paper is collected automatically the moment the timer reaches zero.</p>
              <p>• Do not switch tabs or windows, and do not open floating (picture-in-picture) video.</p>
              <p>• Any of these ends your assessment instantly and is recorded for your teacher.</p>
            </div>
            <PrimaryButton
              onClick={enterExamMode}
              icon={<Maximize2 size={16} />}
              className="w-full justify-center text-xs uppercase font-bold py-3"
            >
              Enter Exam Mode (Fullscreen)
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* Quiz Header Bar */}
      <div className="bg-white border border-[#CBD5E1] p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold text-[#D6A21E] uppercase tracking-wider block">
            {quiz.subjectName} Assessment
          </span>
          <h1 className="text-base font-bold text-[#0B1F4B]">{quiz.title}</h1>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          {/* Server-owned Countdown */}
          {timeLeftSeconds !== null && (
            <span
              className={`flex items-center gap-1 px-2.5 py-1 border font-bold tabular-nums ${
                isLowTime
                  ? 'text-[#991B1B] bg-[#FEF2F2] border-[#EF4444]/50'
                  : 'text-[#0B1F4B] bg-[#F7F7F4] border-[#CBD5E1]'
              }`}
              title="Time remaining (server clock)"
            >
              <Clock size={13} /> {formatDuration(timeLeftSeconds)}
            </span>
          )}

          {/* Connection Status Badge */}
          {isOnline ? (
            <span className="flex items-center gap-1 text-[#0B1F4B] bg-[#F7F7F4] px-2.5 py-1 border border-[#D6A21E]/40">
              <Wifi size={13} className="text-[#D6A21E]" /> Online
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

      {/* Low-time warning band */}
      {isLowTime && (
        <div className="bg-[#FEF2F2] border border-[#EF4444]/40 text-[#991B1B] px-4 py-2.5 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={14} />
          Time is nearly up — your paper will be collected automatically at zero.
        </div>
      )}

      {/* Progress Bar (Strictly Sky Blue, No Green) */}
      <div className="bg-white border border-[#CBD5E1] p-3 shadow-sm">
        <div className="flex justify-between items-center text-xs font-semibold text-[#0B1F4B] mb-1.5">
          <span>
            Question {currentIdx + 1} of {totalQuestions}
          </span>
          <span>
            {answeredCount} of {totalQuestions} Answered
          </span>
        </div>
        <div className="w-full bg-[#F7F7F4] h-2.5 overflow-hidden">
          <div
            className="bg-[#D6A21E] h-full transition-all duration-200"
            style={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Taking Area */}
      <div className="bg-white border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-6">
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
                      ? 'bg-[#0B1F4B] text-white border-[#0B1F4B] font-semibold'
                      : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F7F7F4] hover:border-[#D6A21E]'
                  }`}
                >
                  <span>{option.text}</span>
                  <div
                    className={`w-5 h-5 border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-white bg-[#D6A21E]' : 'border-[#CBD5E1] bg-white'
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
                      ? 'bg-[#0B1F4B] text-white border-[#0B1F4B]'
                      : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F7F7F4] hover:border-[#D6A21E]'
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#0B1F4B]">
              Type Your Answer Below
            </label>
            <input
              type="text"
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleSelectAnswer(e.target.value)}
              placeholder="e.g. 1/4"
              className="w-full px-4 py-3 text-base bg-white text-[#0F172A] border border-[#CBD5E1] focus:outline-hidden focus:border-[#D6A21E] focus:ring-1 focus:ring-[#D6A21E]"
            />
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between bg-white border border-[#CBD5E1] p-4 shadow-sm">
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
      <div className="bg-white border border-[#CBD5E1] p-4 shadow-sm">
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
                    ? 'border-[#0B1F4B] bg-[#0B1F4B] text-white ring-2 ring-[#D6A21E]'
                    : isAnswered
                    ? 'border-[#D6A21E] bg-[#F7F7F4] text-[#0B1F4B]'
                    : 'border-[#CBD5E1] bg-white text-[#64748B] hover:border-[#D6A21E]'
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
            <h3 className="text-lg font-bold text-[#0B1F4B] uppercase tracking-wider pb-2 border-b border-[#CBD5E1]">
              Submission Summary Check
            </h3>
            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/50">
                <span className="text-[#64748B]">Assessment Title:</span>
                <span className="font-bold text-[#0F172A]">{quiz.title}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/50">
                <span className="text-[#64748B]">Answered Questions:</span>
                <span className="font-bold text-[#0B1F4B]">
                  {answeredCount} of {totalQuestions}
                </span>
              </div>
              {timeLeftSeconds !== null && (
                <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/50">
                  <span className="text-[#64748B]">Time Remaining:</span>
                  <span className={`font-bold ${isLowTime ? 'text-[#991B1B]' : 'text-[#0B1F4B]'}`}>
                    {formatDuration(timeLeftSeconds)}
                  </span>
                </div>
              )}
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
        isLoading={isSubmitting}
        onConfirm={() => handleFinalSubmit()}
        onCancel={() => setIsConfirmSubmitOpen(false)}
      />
    </div>
  );
};
