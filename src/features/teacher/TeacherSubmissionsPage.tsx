import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { DataTable, Column } from '../../components/ui/DataTable';
import { InputField, SelectField } from '../../components/ui/FormControls';
import { OutlineButton } from '../../components/ui/Buttons';
import { appDataStore } from '../../services/storage';
import { syncQueueService, SyncState } from '../../lib/sync-queue';
import { Submission } from '../../types/submission';
import { FileCheck, Search, Filter, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export const TeacherSubmissionsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>(appDataStore.getSubmissions());
  const [quizzes, setQuizzes] = useState(appDataStore.getQuizzes());
  const [classes, setClasses] = useState(appDataStore.getClasses());
  const [syncState, setSyncState] = useState<SyncState>(syncQueueService.getState());

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSyncStatus, setSelectedSyncStatus] = useState('ALL');

  useEffect(() => {
    const unsubStore = appDataStore.subscribe(() => {
      setSubmissions(appDataStore.getSubmissions());
      setQuizzes(appDataStore.getQuizzes());
      setClasses(appDataStore.getClasses());
    });
    const unsubSync = syncQueueService.subscribe((state) => {
      setSyncState(state);
    });
    return () => {
      unsubStore();
      unsubSync();
    };
  }, []);

  // Merge queued offline items for clear honest representation
  // If there are offline queued items in syncState, represent them honestly as 'saved_offline' / 'pending_sync'
  const queuedSubmissions: Submission[] = syncState.items.map((item) => ({
    ...item.submission,
    status: 'saved_offline' as const,
    syncStatus: 'offline_queued' as const,
    isOfflineSubmission: true,
  }));

  // Combine and deduplicate
  const allSubmissionsMap = new Map<string, Submission>();
  submissions.forEach((s) => allSubmissionsMap.set(s.id, s));
  queuedSubmissions.forEach((qs) => allSubmissionsMap.set(qs.id, qs));
  const combinedList = Array.from(allSubmissionsMap.values());

  const filtered = combinedList.filter((s) => {
    const matchesSearch =
      s.learnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.learnerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.quizTitle.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesQuiz = selectedQuiz === 'ALL' || s.quizId === selectedQuiz;
    const matchesClass = selectedClass === 'ALL' || s.classId === selectedClass;
    const matchesSync = selectedSyncStatus === 'ALL' || s.syncStatus === selectedSyncStatus;

    return matchesSearch && matchesQuiz && matchesClass && matchesSync;
  });

  const columns: Column<Submission>[] = [
    {
      header: 'Learner',
      accessor: (s) => (
        <div>
          <span className="font-semibold text-xs text-[#0F172A] block">{s.learnerName}</span>
          <span className="font-mono text-[11px] text-[#64748B]">{s.learnerId}</span>
        </div>
      ),
    },
    {
      header: 'Assessment Title',
      accessor: (s) => (
        <div>
          <span className="font-medium text-xs text-[#1C2C5B] block">{s.quizTitle}</span>
          <span className="text-[11px] text-[#64748B]">{s.subjectName} • {s.className}</span>
        </div>
      ),
    },
    {
      header: 'Submission Time',
      accessor: (s) => (
        <span className="text-xs text-[#64748B]">
          {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
        </span>
      ),
    },
    {
      header: 'Transmission / Sync',
      accessor: (s) => {
        if (s.syncStatus === 'offline_queued' || s.syncStatus === 'pending') {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#92400E] bg-[#FEF3C7] px-2 py-0.5 border border-[#F59E0B]/30">
              <WifiOff size={11} /> Saved Offline (Pending Sync)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1C2C5B] bg-[#E8F3FC] px-2 py-0.5 border border-[#6CABDD]/40">
            <Wifi size={11} /> Synced with Server
          </span>
        );
      },
    },
    {
      header: 'Marking Status',
      accessor: (s) => <StatusLabel status={s.status} />,
    },
    {
      header: 'Score Visibility',
      accessor: (s) => {
        const quiz = quizzes.find((q) => q.id === s.quizId);
        const isReleased = quiz?.status === 'results_released';
        return (
          <span className="text-xs font-semibold">
            {isReleased ? (
              <span className="text-[#1C2C5B]">Visible to Learner ({s.percentage}%)</span>
            ) : (
              <span className="text-[#64748B]">Hidden (Pending Release)</span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submission Roster & Sync Tracking"
        subtitle="Track incoming learner responses, verify offline queue synchronizations, and inspect auto-grading states."
      />

      {/* Sync Queue Banner if offline submissions exist */}
      {syncState.pendingCount > 0 && (
        <div className="bg-[#FEF3C7] border border-[#F59E0B] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="text-xs font-bold text-[#92400E] uppercase tracking-wider block">
              Offline Tablet Submissions Detected
            </span>
            <p className="text-xs text-[#92400E] mt-0.5">
              {syncState.pendingCount} submission{syncState.pendingCount === 1 ? '' : 's'} safely preserved on local tablet storage.
              Records are not counted on the school central database until verified synchronization occurs.
            </p>
          </div>
          <OutlineButton
            onClick={() => syncQueueService.processQueue()}
            className="text-xs py-1.5 whitespace-nowrap bg-white text-[#92400E] border-[#F59E0B]"
            icon={<RefreshCw size={13} />}
          >
            Trigger Sync Now
          </OutlineButton>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white border border-[#CBD5E1] p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <InputField
            type="text"
            placeholder="Search by learner name, ID, or quiz..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-[#64748B] uppercase">Quiz:</span>
            <SelectField
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="text-xs py-1"
            >
              <option value="ALL">All Assessments</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-[#64748B] uppercase">Class:</span>
            <SelectField
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs py-1"
            >
              <option value="ALL">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-[#64748B] uppercase">Sync:</span>
            <SelectField
              value={selectedSyncStatus}
              onChange={(e) => setSelectedSyncStatus(e.target.value)}
              className="text-xs py-1"
            >
              <option value="ALL">All States</option>
              <option value="synced">Synced Only</option>
              <option value="offline_queued">Offline Queued</option>
            </SelectField>
          </div>

          <span className="text-xs text-[#64748B] font-medium border-l border-[#CBD5E1] pl-2.5">
            {filtered.length} Records
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(s) => s.id}
        emptyMessage="No submissions matching filter criteria."
      />
    </div>
  );
};
