import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { appDataStore } from '../../services/storage';
import { syncQueueService, SyncState } from '../../lib/sync-queue';
import {
  Users,
  GraduationCap,
  Layers,
  HelpCircle,
  Plus,
  RefreshCw,
  FileCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [learners, setLearners] = useState(appDataStore.getLearners());
  const [teachers, setTeachers] = useState(appDataStore.getTeachers());
  const [classes, setClasses] = useState(appDataStore.getClasses());
  const [quizzes, setQuizzes] = useState(appDataStore.getQuizzes());
  const [submissions, setSubmissions] = useState(appDataStore.getSubmissions());
  const [settings, setSettings] = useState(appDataStore.getSettings());
  const [syncState, setSyncState] = useState<SyncState>(syncQueueService.getState());

  useEffect(() => {
    const unsubStore = appDataStore.subscribe(() => {
      setLearners(appDataStore.getLearners());
      setTeachers(appDataStore.getTeachers());
      setClasses(appDataStore.getClasses());
      setQuizzes(appDataStore.getQuizzes());
      setSubmissions(appDataStore.getSubmissions());
      setSettings(appDataStore.getSettings());
    });
    const unsubSync = syncQueueService.subscribe((state) => {
      setSyncState(state);
    });
    return () => {
      unsubStore();
      unsubSync();
    };
  }, []);

  const totalLearners = learners.length;
  const activeLearners = learners.filter((l) => l.isActive).length;
  const totalTeachers = teachers.length;
  const totalClasses = classes.length;
  const publishedQuizzes = quizzes.filter(
    (q) => q.status === 'published' || q.status === 'in_progress' || q.status === 'results_released'
  ).length;

  const syncedCount = submissions.filter((s) => s.syncStatus === 'synced').length;
  const offlineQueuedCount = syncState.pendingCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Administrative Overview"
        subtitle="Manage academic structures, enrollments, assessment compliance, and offline device synchronization."
        actions={
          <div className="flex gap-2">
            <OutlineButton onClick={() => navigate('/admin/learners')} icon={<Plus size={14} />}>
              Add Learner
            </OutlineButton>
            <PrimaryButton onClick={() => navigate('/admin/classes')} icon={<Layers size={14} />}>
              Manage Classes
            </PrimaryButton>
          </div>
        }
      />

      {/* Structural Summary Metrics — Clean Rectangular Cards, Strict Brand Colours */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Total Enrolled Learners</span>
            <Users size={16} className="text-[#1C2C5B]" />
          </div>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">{totalLearners}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            {activeLearners} active accounts across {totalClasses} classes
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Teaching Faculty</span>
            <GraduationCap size={16} className="text-[#1C2C5B]" />
          </div>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">{totalTeachers}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            Full-time certified educators
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Quizzes Conducted This Term</span>
            <HelpCircle size={16} className="text-[#6CABDD]" />
          </div>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">{publishedQuizzes}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            {quizzes.length} total assessments created
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Sync & Submission Status</span>
            <RefreshCw size={16} className="text-[#1C2C5B]" />
          </div>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">{syncedCount}</div>
          <div className="text-xs mt-1 font-medium text-[#64748B]">
            {offlineQueuedCount > 0 ? (
              <span className="text-[#B45309] font-bold">
                {offlineQueuedCount} offline submissions awaiting sync
              </span>
            ) : (
              <span>All tablet attempts fully synchronized</span>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-column administrative split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: School Assessment Registry & Status */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
                  Recent School-Wide Assessments
                </h2>
                <p className="text-xs text-[#64748B]">
                  Active and recently completed quizzes across all grades
                </p>
              </div>
              <OutlineButton onClick={() => navigate('/admin/analytics')} className="text-xs py-1 px-2.5">
                Full Analytics <ArrowRight size={12} className="inline ml-1" />
              </OutlineButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1C2C5B] text-white">
                    <th className="p-2.5 font-semibold uppercase">Assessment Title</th>
                    <th className="p-2.5 font-semibold uppercase">Grade / Class</th>
                    <th className="p-2.5 font-semibold uppercase">Subject</th>
                    <th className="p-2.5 font-semibold uppercase">Status</th>
                    <th className="p-2.5 font-semibold uppercase text-right">Offline Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]/60">
                  {quizzes.slice(0, 5).map((quiz) => (
                    <tr key={quiz.id} className="hover:bg-[#F5F8FC]">
                      <td className="p-2.5 font-medium text-[#0F172A]">
                        {quiz.title}
                        <span className="block text-[11px] text-[#64748B]">
                          Created by {quiz.authorName}
                        </span>
                      </td>
                      <td className="p-2.5 text-[#0F172A]">{quiz.className}</td>
                      <td className="p-2.5 text-[#0F172A]">{quiz.subjectName}</td>
                      <td className="p-2.5">
                        <StatusLabel status={quiz.status} />
                      </td>
                      <td className="p-2.5 text-right font-medium">
                        {quiz.allowOffline ? (
                          <span className="text-[#1C2C5B]">Enabled (Cached)</span>
                        ) : (
                          <span className="text-[#64748B]">Online Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Action Hub */}
          <div className="bg-[#E8F3FC] border border-[#6CABDD]/50 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B] mb-2">
              Administrative Quick Actions
            </h3>
            <p className="text-xs text-[#64748B] mb-4">
              Direct access to configure classes, assign staff members, and register student cohorts.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <OutlineButton onClick={() => navigate('/admin/learners')} icon={<Users size={14} />}>
                Register New Learner
              </OutlineButton>
              <OutlineButton onClick={() => navigate('/admin/teachers')} icon={<GraduationCap size={14} />}>
                Add Teacher
              </OutlineButton>
              <OutlineButton onClick={() => navigate('/admin/classes')} icon={<Layers size={14} />}>
                Create Class
              </OutlineButton>
              <OutlineButton onClick={() => navigate('/admin/subjects')} icon={<HelpCircle size={14} />}>
                Configure Subjects
              </OutlineButton>
            </div>
          </div>
        </div>

        {/* Right Col: Sync & System Activity Panel */}
        <div className="space-y-6">
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
                Device & Sync Status
              </h3>
              <p className="text-xs text-[#64748B]">School tablet offline synchronizer</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-[#F5F8FC] border border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Pending Tablet Uploads:</span>
                <span className="font-bold text-[#0F172A]">
                  {syncState.pendingCount} record{syncState.pendingCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F5F8FC] border border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Last Full Sync:</span>
                <span className="font-medium text-[#0F172A]">
                  {syncState.lastSyncTime
                    ? new Date(syncState.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'System Active'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F5F8FC] border border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Local Cache Engine:</span>
                <span className="font-semibold text-[#1C2C5B]">IndexedDB (v1)</span>
              </div>

              {syncState.pendingCount > 0 && (
                <div className="mt-3 p-3 bg-[#FEF3C7] border border-[#F59E0B]/40 text-[#92400E]">
                  <p className="font-bold">Offline Queue Notice</p>
                  <p className="text-[11px] mt-0.5">
                    Submissions stored on local tablets will automatically push to the server upon network reconnect.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* School Term Details */}
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B] pb-3 mb-3 border-b border-[#CBD5E1]">
              Academic Calendar
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">School:</span>
                <span className="font-semibold text-[#0F172A]">{settings.schoolName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Academic Year:</span>
                <span className="font-semibold text-[#0F172A]">{settings.academicYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Current Term:</span>
                <span className="font-semibold text-[#1C2C5B]">{settings.currentTerm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Term Assessment Close:</span>
                <span className="font-medium text-[#0F172A]">
                  {settings.termEndDate
                    ? new Date(settings.termEndDate).toLocaleDateString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Not set'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
