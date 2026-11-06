import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import {
  fetchAdminDashboardOverview,
  AdminDashboardOverview,
} from '../../services/admin-dashboard-api';
import {
  Users,
  GraduationCap,
  Layers,
  HelpCircle,
  Plus,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Wifi,
  Server,
  CalendarDays,
} from 'lucide-react';

// The overview is refreshed on this cadence (and whenever the tab regains focus)
// so an administrator watching the screen sees the school's live state.
const REFRESH_INTERVAL_MS = 30_000;

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString();
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchAdminDashboardOverview();
      setOverview(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach the server.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="School Administrative Overview"
          subtitle="Loading the live school state from the server…"
        />
        <div className="bg-white border border-[#CBD5E1] p-10 text-center text-sm text-[#64748B]">
          <RefreshCw size={20} className="mx-auto mb-3 animate-spin text-[#0B1F4B]" aria-hidden="true" />
          Connecting to the school database…
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="School Administrative Overview"
          subtitle="Live school data is currently unavailable."
        />
        <div className="bg-white border border-[#F59E0B]/50 p-6 text-sm">
          <div className="flex items-start gap-3 text-[#92400E]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">Unable to load the live dashboard</p>
              <p className="mt-1 text-[#64748B]">{error}</p>
            </div>
          </div>
          <div className="mt-4">
            <PrimaryButton onClick={() => void load()} icon={<RefreshCw size={14} />}>
              Retry
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  const metrics = overview!.metrics;
  const school = overview!.school;
  const devices = overview!.devices;
  const recentQuizzes = overview!.recentQuizzes;
  const onlineTablets = devices.onlineLearnerTablets;

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Administrative Overview"
        subtitle={`Live school state · last refreshed ${formatClock(overview!.generatedAt)}`}
        actions={
          <div className="flex gap-2">
            <OutlineButton
              onClick={() => void load()}
              icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </OutlineButton>
            <OutlineButton onClick={() => navigate('/admin/learners')} icon={<Plus size={14} />}>
              Add Learner
            </OutlineButton>
            <PrimaryButton onClick={() => navigate('/admin/classes')} icon={<Layers size={14} />}>
              Manage Classes
            </PrimaryButton>
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-3 p-3 bg-[#FEF3C7] border border-[#F59E0B]/40 text-[#92400E] text-xs">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Showing the last known figures — the latest refresh failed.</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Structural Summary Metrics — Clean Rectangular Cards, Strict Brand Colours */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Total Enrolled Learners</span>
            <Users size={16} className="text-[#0B1F4B]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-extrabold text-[#0B1F4B]">{formatCount(metrics.learnersTotal)}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            {formatCount(metrics.learnersActive)} active accounts across {formatCount(metrics.classesTotal)} classes
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Teaching Faculty</span>
            <GraduationCap size={16} className="text-[#0B1F4B]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-extrabold text-[#0B1F4B]">{formatCount(metrics.teachersTotal)}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            {formatCount(metrics.teachersActive)} certified educators active
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Assessments Created</span>
            <HelpCircle size={16} className="text-[#D6A21E]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-extrabold text-[#0B1F4B]">{formatCount(metrics.quizzesTotal)}</div>
          <div className="text-xs text-[#64748B] mt-1 font-medium">
            {formatCount(metrics.quizzesOpen)} open · {formatCount(metrics.quizzesDraft)} draft · {formatCount(metrics.quizzesClosed)} closed
          </div>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
            <span>Submissions Received</span>
            <RefreshCw size={16} className="text-[#0B1F4B]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-extrabold text-[#0B1F4B]">{formatCount(metrics.submissionsTotal)}</div>
          <div className="text-xs mt-1 font-medium text-[#64748B]">
            {metrics.pendingServerSync > 0 ? (
              <span className="text-[#B45309] font-bold">
                {formatCount(metrics.pendingServerSync)} awaiting server sync
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
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#0B1F4B]">
                  Recent School-Wide Assessments
                </h2>
                <p className="text-xs text-[#64748B]">
                  The most recently created quizzes across all grades
                </p>
              </div>
              <OutlineButton onClick={() => navigate('/admin/analytics')} className="text-xs py-1 px-2.5">
                Full Analytics <ArrowRight size={12} className="inline ml-1" />
              </OutlineButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0B1F4B] text-white">
                    <th className="p-2.5 font-semibold uppercase">Assessment Title</th>
                    <th className="p-2.5 font-semibold uppercase">Grade / Class</th>
                    <th className="p-2.5 font-semibold uppercase">Subject</th>
                    <th className="p-2.5 font-semibold uppercase">Status</th>
                    <th className="p-2.5 font-semibold uppercase text-right">Offline Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CBD5E1]/60">
                  {recentQuizzes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[#64748B]">
                        No assessments have been created yet.
                      </td>
                    </tr>
                  ) : (
                    recentQuizzes.map((quiz) => (
                      <tr key={quiz.id} className="hover:bg-[#F7F7F4]">
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
                            <span className="text-[#0B1F4B]">Enabled (Cached)</span>
                          ) : (
                            <span className="text-[#64748B]">Online Only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Action Hub */}
          <div className="bg-[#F7F7F4] border border-[#D6A21E]/50 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B1F4B] mb-2">
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

        {/* Right Col: Live Device & Sync Panel */}
        <div className="space-y-6">
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-sm">
            <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B1F4B]">
                Device &amp; Sync Status
              </h3>
              <p className="text-xs text-[#64748B]">Live learner tablet presence</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-[#F7F7F4] border border-[#CBD5E1]/60">
                <span className="flex items-center gap-1.5 text-[#64748B]">
                  <Wifi size={13} aria-hidden="true" /> Online Learner Tablets:
                </span>
                <span className="font-bold text-[#0F172A]">
                  {onlineTablets === null ? '—' : onlineTablets}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F7F7F4] border border-[#CBD5E1]/60">
                <span className="flex items-center gap-1.5 text-[#64748B]">
                  <Server size={13} aria-hidden="true" /> Awaiting Server Sync:
                </span>
                <span className="font-bold text-[#0F172A]">
                  {formatCount(metrics.pendingServerSync)} record{metrics.pendingServerSync === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F7F7F4] border border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Offline Submissions Recorded:</span>
                <span className="font-bold text-[#0F172A]">{formatCount(metrics.offlineSubmissions)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F7F7F4] border border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Presence Window:</span>
                <span className="font-medium text-[#0F172A]">{devices.onlineWindowSeconds}s heartbeat</span>
              </div>

              {metrics.pendingServerSync > 0 && (
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
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B1F4B] pb-3 mb-3 border-b border-[#CBD5E1] flex items-center gap-1.5">
              <CalendarDays size={14} aria-hidden="true" /> Academic Calendar
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">School:</span>
                <span className="font-semibold text-[#0F172A]">{school.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Academic Year:</span>
                <span className="font-semibold text-[#0F172A]">{school.academicYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Current Term:</span>
                <span className="font-semibold text-[#0B1F4B]">{school.currentTerm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Term Assessment Close:</span>
                <span className="font-medium text-[#0F172A]">
                  {school.termEndDate
                    ? new Date(school.termEndDate).toLocaleDateString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Pass Mark:</span>
                <span className="font-semibold text-[#0F172A]">{school.passMark}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
