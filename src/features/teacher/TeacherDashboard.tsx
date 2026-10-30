import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton, SecondaryButton } from '../../components/ui/Buttons';
import { appDataStore } from '../../services/storage';
import { Quiz } from '../../types/quiz';
import {
  Sparkles,
  Plus,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
  BookOpen,
  WifiOff,
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState<Quiz[]>(appDataStore.getQuizzes());
  const [classes, setClasses] = useState(appDataStore.getClasses());
  const [submissions, setSubmissions] = useState(appDataStore.getSubmissions());

  useEffect(() => {
    return appDataStore.subscribe(() => {
      setQuizzes(appDataStore.getQuizzes());
      setClasses(appDataStore.getClasses());
      setSubmissions(appDataStore.getSubmissions());
    });
  }, []);

  const drafts = quizzes.filter((q) => q.status === 'draft');
  const inProgressQuizzes = quizzes.filter(
    (q) => q.status === 'in_progress' || q.status === 'published'
  );
  const closedAwaitingRelease = quizzes.filter((q) => q.status === 'closed');
  const releasedQuizzes = quizzes.filter((q) => q.status === 'results_released');

  // Pending submissions across active quizzes
  const pendingOfflineSubmissions = submissions.filter(
    (s) => s.syncStatus === 'offline_queued' || s.syncStatus === 'pending'
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name || 'Educator'}`}
        subtitle="Review weekly assessment progress, draft AI-assisted questions, and verify student submission synchronization."
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

      {/* Teacher Action Alerts: Urgent Next Steps */}
      {closedAwaitingRelease.length > 0 && (
        <div className="bg-[#E8F3FC] border border-[#6CABDD] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-[#1C2C5B] uppercase tracking-wider block">
              Action Required: Pending Result Release
            </span>
            <p className="text-xs text-[#0F172A] mt-0.5">
              <span className="font-semibold">{closedAwaitingRelease[0].title}</span> is closed.
              Learners cannot view their marks until you manually authorize release.
            </p>
          </div>
          <PrimaryButton
            onClick={() => navigate(`/teacher/results?quizId=${closedAwaitingRelease[0].id}`)}
            className="text-xs py-1.5 whitespace-nowrap"
          >
            Review & Release Results
          </PrimaryButton>
        </div>
      )}

      {/* Top Actionable Summary Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/teacher/quizzes?tab=drafts')}
          className="bg-white border border-[#CBD5E1] p-5 shadow-xs cursor-pointer hover:border-[#6CABDD] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Drafts Awaiting Review</span>
            <HelpCircle size={16} className="text-[#64748B]" />
          </div>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">{drafts.length}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            Quizzes needing question approval
          </div>
        </div>

        <div
          onClick={() => navigate('/teacher/quizzes?tab=in_progress')}
          className="bg-white border border-[#CBD5E1] p-5 shadow-xs cursor-pointer hover:border-[#6CABDD] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>In-Progress Quizzes</span>
            <Clock size={16} className="text-[#6CABDD]" />
          </div>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">{inProgressQuizzes.length}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            Currently accessible by learners
          </div>
        </div>

        <div
          onClick={() => navigate('/teacher/submissions')}
          className="bg-white border border-[#CBD5E1] p-5 shadow-xs cursor-pointer hover:border-[#6CABDD] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Total Submissions</span>
            <FileCheck size={16} className="text-[#1C2C5B]" />
          </div>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">{submissions.length}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            {pendingOfflineSubmissions.length > 0 ? (
              <span className="text-[#B45309] font-bold">
                {pendingOfflineSubmissions.length} pending tablet sync
              </span>
            ) : (
              'All submissions synchronized'
            )}
          </div>
        </div>

        <div
          onClick={() => navigate('/teacher/results')}
          className="bg-white border border-[#CBD5E1] p-5 shadow-xs cursor-pointer hover:border-[#6CABDD] transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Released Marksheets</span>
            <CheckCircle2 size={16} className="text-[#1C2C5B]" />
          </div>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">{releasedQuizzes.length}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            Results published to learner portals
          </div>
        </div>
      </div>

      {/* Main Teacher Workspace Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Assessments & Submissions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
                  Active Assessments in Progress
                </h2>
                <p className="text-xs text-[#64748B]">
                  Live quizzes assigned to your student cohorts
                </p>
              </div>
              <OutlineButton
                onClick={() => navigate('/teacher/quizzes')}
                className="text-xs py-1 px-2.5"
              >
                All Quizzes <ArrowRight size={12} className="inline ml-1" />
              </OutlineButton>
            </div>

            {inProgressQuizzes.length === 0 ? (
              <div className="p-8 text-center bg-[#F5F8FC] border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">
                No assessments currently running. Create or publish a draft to begin.
              </div>
            ) : (
              <div className="space-y-3">
                {inProgressQuizzes.map((quiz) => {
                  const quizSubs = submissions.filter((s) => s.quizId === quiz.id);
                  return (
                    <div
                      key={quiz.id}
                      className="p-4 bg-[#F5F8FC] border border-[#CBD5E1] hover:border-[#6CABDD] transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[11px] font-semibold text-[#6CABDD] uppercase tracking-wider block">
                            {quiz.subjectName} • {quiz.className} ({quiz.grade})
                          </span>
                          <h4 className="text-sm font-bold text-[#1C2C5B]">{quiz.title}</h4>
                        </div>
                        <StatusLabel status={quiz.status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] mt-3 pt-2 border-t border-[#CBD5E1]/60">
                        <span>{quiz.questions.length} Questions</span>
                        <span>•</span>
                        <span>{quiz.durationMinutes} Minutes</span>
                        <span>•</span>
                        <span>
                          {quiz.allowOffline ? (
                            <span className="text-[#1C2C5B] font-medium">Offline Permitted</span>
                          ) : (
                            'Online Only'
                          )}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-[#0F172A]">
                          {quizSubs.length} Submissions Received
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <OutlineButton
                            onClick={() => navigate(`/teacher/quizzes/${quiz.id}`)}
                            className="text-xs py-1 px-2"
                          >
                            Details
                          </OutlineButton>
                          <PrimaryButton
                            onClick={() => navigate(`/teacher/results?quizId=${quiz.id}`)}
                            className="text-xs py-1 px-2"
                          >
                            Submissions & Release
                          </PrimaryButton>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick AI Question Generator Teaser */}
          <div className="bg-[#1C2C5B] text-white p-5 shadow-xs border border-[#1C2C5B]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-[#6CABDD] uppercase tracking-wider block">
                  AI Quiz Generation Engine
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Draft Curriculum Assessments in Seconds
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Enter topics taught during the week (e.g. "Fractions", "Forces and Movement", "Reading Comprehension").
                  The AI drafts curriculum-aligned multiple-choice questions with answer keys and explanations for your review.
                </p>
              </div>
              <PrimaryButton
                onClick={() => navigate('/teacher/quizzes/new?mode=ai')}
                className="shrink-0 text-xs py-2 px-3"
                icon={<Sparkles size={14} />}
              >
                Launch AI Wizard
              </PrimaryButton>
            </div>
          </div>
        </div>

        {/* Right Col: Assigned Classes & Offline Status */}
        <div className="space-y-6">
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
                Your Assigned Classes
              </h3>
              <OutlineButton
                onClick={() => navigate('/teacher/classes')}
                className="text-xs py-0.5 px-2"
              >
                All
              </OutlineButton>
            </div>

            <div className="space-y-3">
              {classes.slice(0, 3).map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/teacher/classes?classId=${cls.id}`)}
                  className="p-3 bg-[#F5F8FC] border border-[#CBD5E1] hover:border-[#6CABDD] cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-xs text-[#1C2C5B]">{cls.name}</span>
                    <span className="text-[11px] text-[#64748B] font-mono">{cls.grade}</span>
                  </div>
                  <div className="text-[11px] text-[#64748B] flex justify-between">
                    <span>{cls.learnerCount ?? 0} Enrolled Students</span>
                    <span className="text-[#1C2C5B] font-semibold">{cls.room || 'Room not set'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Offline Sync Information Box */}
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B] pb-3 mb-3 border-b border-[#CBD5E1]">
              Offline Assessment Policy
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed mb-3">
              Learners with intermittent connectivity can download approved quizzes in advance.
              Answers are kept in the tablet's IndexedDB and synchronize automatically upon reconnection.
            </p>
            <div className="p-3 bg-[#E8F3FC] border border-[#6CABDD]/40 text-xs">
              <span className="font-bold text-[#1C2C5B] block mb-0.5">Note:</span>
              <span>
                Queued tablet submissions appear in the sync status bar at the top of the app and are uploaded automatically once connectivity returns.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
