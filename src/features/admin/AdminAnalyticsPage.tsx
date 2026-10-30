import React, { useMemo } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { AlertCircle } from 'lucide-react';
import { appDataStore } from '../../services/storage';

export const AdminAnalyticsPage: React.FC = () => {
  const settings = appDataStore.getSettings();

  const {
    gradeScoreData,
    subjectPerformanceData,
    weeklyActivityData,
    topicsNeedingRevision,
    schoolMean,
    completionRate,
    offlineShare,
  } = useMemo(() => {
    const quizzes = appDataStore.getQuizzes();
    const submissions = appDataStore.getSubmissions();
    const classes = appDataStore.getClasses();

    const meanOf = (values: number[]): number | null =>
      values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    // School-wide mean across all real submissions.
    const allPercentages = submissions.map((s) => s.percentage);
    const schoolMeanValue = meanOf(allPercentages);

    // Completion: submitted results vs expected submissions for active assessments.
    const activeQuizzes = quizzes.filter(
      (q) => q.status === 'published' || q.status === 'in_progress'
    );
    let expected = 0;
    activeQuizzes.forEach((q) => {
      const cls = classes.find((c) => c.id === q.classId);
      expected += cls?.learnerCount || 0;
    });
    const actual = submissions.filter((s) => activeQuizzes.some((q) => q.id === s.quizId)).length;
    const completionRateValue = expected > 0 ? Math.round((actual / expected) * 100) : null;

    // Offline share.
    const offlineCount = submissions.filter((s) => s.isOfflineSubmission).length;
    const offlineShareValue =
      submissions.length > 0 ? Math.round((offlineCount / submissions.length) * 100) : null;

    // Average + completion by grade cohort.
    const gradeGroups = new Map<string, { percentages: number[]; expected: number; actual: number }>();
    classes.forEach((cls) => {
      const g = cls.grade || 'Unassigned';
      const entry = gradeGroups.get(g) || { percentages: [], expected: 0, actual: 0 };
      entry.expected += cls.learnerCount || 0;
      gradeGroups.set(g, entry);
    });
    submissions.forEach((s) => {
      const cls = classes.find((c) => c.id === s.classId);
      const g = cls?.grade || 'Unassigned';
      const entry = gradeGroups.get(g) || { percentages: [], expected: 0, actual: 0 };
      entry.percentages.push(s.percentage);
      entry.actual += 1;
      gradeGroups.set(g, entry);
    });
    const gradeData = Array.from(gradeGroups.entries())
      .filter(([, v]) => v.percentages.length > 0)
      .map(([grade, v]) => ({
        grade,
        averageScore: meanOf(v.percentages) || 0,
        completionRate: v.expected > 0 ? Math.round((v.actual / v.expected) * 100) : 0,
      }))
      .sort((a, b) => a.grade.localeCompare(b.grade));

    // Subject performance vs school pass-mark target.
    const subjectGroups = new Map<string, number[]>();
    submissions.forEach((s) => {
      const key = s.subjectName || 'Unassigned';
      const arr = subjectGroups.get(key) || [];
      arr.push(s.percentage);
      subjectGroups.set(key, arr);
    });
    const subjectData = Array.from(subjectGroups.entries()).map(([subject, arr]) => ({
      subject,
      average: meanOf(arr) || 0,
      target: settings.defaultPassMark,
    }));

    // Weekly submission volume (last 6 activity weeks).
    const byWeek = new Map<string, { submissions: number; offlineSynced: number; date: number }>();
    submissions.forEach((s) => {
      if (!s.submittedAt) return;
      const d = new Date(s.submittedAt);
      if (isNaN(d.getTime())) return;
      const monday = new Date(d);
      const day = (monday.getDay() + 6) % 7;
      monday.setDate(monday.getDate() - day);
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString().slice(0, 10);
      const entry = byWeek.get(key) || { submissions: 0, offlineSynced: 0, date: monday.getTime() };
      entry.submissions += 1;
      if (s.isOfflineSubmission) entry.offlineSynced += 1;
      byWeek.set(key, entry);
    });
    const weeklyData = Array.from(byWeek.entries())
      .sort((a, b) => a[1].date - b[1].date)
      .slice(-6)
      .map(([key, v]) => ({ week: `w/c ${key}`, submissions: v.submissions, offlineSynced: v.offlineSynced }));

    // Topics below mastery threshold, aggregated from real answers.
    const questionMeta = new Map<string, { topic: string; subject: string; grade: string }>();
    quizzes.forEach((q) => {
      const cls = classes.find((c) => c.id === q.classId);
      q.questions.forEach((question) => {
        questionMeta.set(`${q.id}:${question.id}`, {
          topic: question.topic || 'General',
          subject: q.subjectName || 'Unassigned',
          grade: cls?.grade || 'Unassigned',
        });
      });
    });
    const topicTotals = new Map<
      string,
      { correct: number; total: number; learners: Set<string>; meta: { subject: string; grade: string } }
    >();
    submissions.forEach((s) => {
      (s.answerDetails || []).forEach((a) => {
        const meta = questionMeta.get(`${s.quizId}:${a.questionId}`);
        if (!meta) return;
        const entry =
          topicTotals.get(meta.topic) ||
          { correct: 0, total: 0, learners: new Set<string>(), meta: { subject: meta.subject, grade: meta.grade } };
        entry.total += 1;
        if (a.isCorrect) entry.correct += 1;
        if (!a.isCorrect) entry.learners.add(s.learnerId);
        topicTotals.set(meta.topic, entry);
      });
    });
    const revisionTopics = Array.from(topicTotals.entries())
      .map(([topic, v]) => ({
        topic,
        subject: v.meta.subject,
        grade: v.meta.grade,
        accuracyValue: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
        affectedCount: v.learners.size,
      }))
      .filter((t) => t.accuracyValue < settings.defaultPassMark)
      .sort((a, b) => a.accuracyValue - b.accuracyValue)
      .map((t) => ({
        ...t,
        accuracy: `${t.accuracyValue}%`,
        status:
          t.accuracyValue < settings.defaultPassMark - 10
            ? 'High Revision Priority'
            : 'Review Recommended',
      }));

    return {
      gradeScoreData: gradeData,
      subjectPerformanceData: subjectData,
      weeklyActivityData: weeklyData,
      topicsNeedingRevision: revisionTopics,
      schoolMean: schoolMeanValue,
      completionRate: completionRateValue,
      offlineShare: offlineShareValue,
    };
  }, [settings.defaultPassMark]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="School-Wide Assessment Analytics"
        subtitle="Holistic performance metrics, grade cohort comparisons, and diagnostic topic revision signals."
      />

      {/* Top Level Benchmark Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
            School Mean Score
          </span>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">
            {schoolMean === null ? '—' : `${schoolMean}%`}
          </div>
          <p className="text-xs text-[#64748B] mt-1">Across all recorded submissions</p>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
            Assessment Completion
          </span>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">
            {completionRate === null ? '—' : `${completionRate}%`}
          </div>
          <p className="text-xs text-[#64748B] mt-1">Submitted results against enrolled learners</p>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
            Offline Assessment Share
          </span>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">
            {offlineShare === null ? '—' : `${offlineShare}%`}
          </div>
          <p className="text-xs text-[#64748B] mt-1">Queued and synced from tablets</p>
        </div>

        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
            Identified Revision Topics
          </span>
          <div className="text-3xl font-extrabold text-[#1C2C5B]">
            {topicsNeedingRevision.length} Focus {topicsNeedingRevision.length === 1 ? 'Area' : 'Areas'}
          </div>
          <p className="text-xs text-[#64748B] mt-1">Topics below the {settings.defaultPassMark}% mastery threshold</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cohort Averages by Grade */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
              Average Assessment Score by Grade Cohort
            </h3>
            <p className="text-xs text-[#64748B]">
              Aggregated results for all assessed cohorts
            </p>
          </div>

          {gradeScoreData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeScoreData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                  <XAxis dataKey="grade" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1C2C5B',
                      borderColor: '#1C2C5B',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="averageScore" name="Average Score (%)" fill="#1C2C5B" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="completionRate" name="Completion Rate (%)" fill="#6CABDD" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center border border-dashed border-[#CBD5E1] bg-[#F5F8FC]">
              <AlertCircle size={20} className="text-[#94A3B8] mb-2" />
              <p className="text-xs font-semibold text-[#64748B]">No grade-level results recorded yet.</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                Cohort averages appear once learners submit assessments.
              </p>
            </div>
          )}
        </div>

        {/* Subject Comparison */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
              Subject Performance vs School Benchmark
            </h3>
            <p className="text-xs text-[#64748B]">
              Comparison against the {settings.defaultPassMark}% school pass mark
            </p>
          </div>

          {subjectPerformanceData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectPerformanceData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis dataKey="subject" type="category" stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1C2C5B',
                      borderColor: '#1C2C5B',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="average" name="Cohort Average (%)" fill="#6CABDD" />
                  <Bar dataKey="target" name="School Target (%)" fill="#CBD5E1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center border border-dashed border-[#CBD5E1] bg-[#F5F8FC]">
              <AlertCircle size={20} className="text-[#94A3B8] mb-2" />
              <p className="text-xs font-semibold text-[#64748B]">No subject results recorded yet.</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                Subject comparisons appear once assessments are submitted.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assessment Activity Over Time Line Chart */}
      <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
        <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
            Assessment Volume & Tablet Offline Sync Activity
          </h3>
          <p className="text-xs text-[#64748B]">Weekly quiz submissions from recorded results</p>
        </div>

        {weeklyActivityData.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyActivityData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                <XAxis dataKey="week" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C2C5B',
                    borderColor: '#1C2C5B',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Line
                  type="monotone"
                  dataKey="submissions"
                  name="Total Submissions"
                  stroke="#1C2C5B"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#1C2C5B' }}
                />
                <Line
                  type="monotone"
                  dataKey="offlineSynced"
                  name="Queued Tablet Syncs"
                  stroke="#6CABDD"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#6CABDD' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-56 w-full flex flex-col items-center justify-center text-center border border-dashed border-[#CBD5E1] bg-[#F5F8FC]">
            <AlertCircle size={20} className="text-[#94A3B8] mb-2" />
            <p className="text-xs font-semibold text-[#64748B]">No submission activity recorded yet.</p>
            <p className="text-[11px] text-[#94A3B8] mt-1">
              Volume trends appear as learners submit assessments over time.
            </p>
          </div>
        )}
      </div>

      {/* Diagnostic Signals: Topics Requiring Revision */}
      <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
        <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B] flex items-center gap-2">
            <AlertCircle size={16} className="text-[#1C2C5B]" />
            <span>Curriculum Topics Requiring Faculty Review</span>
          </h3>
          <p className="text-xs text-[#64748B]">
            Concepts where cohort accuracy fell below the {settings.defaultPassMark}% mastery threshold
          </p>
        </div>

        {topicsNeedingRevision.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-[#CBD5E1] bg-[#F5F8FC]">
            <p className="text-xs font-semibold text-[#64748B]">
              No topics currently below the mastery threshold.
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-1">
              Revision signals are derived from graded learner answers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1C2C5B] text-white">
                  <th className="p-2.5 font-semibold uppercase">Topic Domain</th>
                  <th className="p-2.5 font-semibold uppercase">Subject & Grade</th>
                  <th className="p-2.5 font-semibold uppercase">Cohort Accuracy</th>
                  <th className="p-2.5 font-semibold uppercase">Affected Learners</th>
                  <th className="p-2.5 font-semibold uppercase text-right">Pedagogical Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CBD5E1]/60">
                {topicsNeedingRevision.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#F5F8FC]">
                    <td className="p-2.5 font-semibold text-[#0F172A]">{item.topic}</td>
                    <td className="p-2.5 text-[#64748B]">
                      {item.subject} — {item.grade}
                    </td>
                    <td className="p-2.5 font-bold text-[#1C2C5B]">{item.accuracy}</td>
                    <td className="p-2.5 text-[#0F172A]">{item.affectedCount} learners</td>
                    <td className="p-2.5 text-right font-medium text-[#1C2C5B]">
                      <span className="bg-[#E8F3FC] px-2 py-0.5 border border-[#6CABDD]/40">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
