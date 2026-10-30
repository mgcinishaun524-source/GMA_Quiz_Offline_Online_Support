import React, { useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { SelectField } from '../../components/ui/FormControls';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AlertCircle } from 'lucide-react';
import { appDataStore } from '../../services/storage';

export const TeacherAnalyticsPage: React.FC = () => {
  const classes = appDataStore.getClasses();
  const settings = appDataStore.getSettings();
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');

  const { quizPerformanceData, topicAccuracyData, learnersNeedingSupport } = useMemo(() => {
    const quizzes = appDataStore.getQuizzes();
    const submissions = appDataStore.getSubmissions();

    const classQuizzes = quizzes.filter((q) => q.classId === selectedClass);
    const classSubmissions = submissions.filter((s) => s.classId === selectedClass);

    // Class average across quizzes that actually have submitted results.
    const perf: Array<{ quiz: string; classAverage: number; benchmark: number }> = [];
    classQuizzes.forEach((q) => {
      const subs = classSubmissions.filter((s) => s.quizId === q.id);
      if (subs.length === 0) return;
      const avg = Math.round(subs.reduce((acc, s) => acc + s.percentage, 0) / subs.length);
      perf.push({
        quiz: q.title.length > 22 ? `${q.title.slice(0, 22)}…` : q.title,
        classAverage: avg,
        benchmark: settings.defaultPassMark,
      });
    });

    // Topic-level accuracy derived from real answer records.
    const questionTopicMap = new Map<string, string>();
    quizzes.forEach((q) => {
      q.questions.forEach((question) => {
        questionTopicMap.set(`${q.id}:${question.id}`, question.topic || 'General');
      });
    });

    const topicTotals = new Map<string, { correct: number; total: number }>();
    classSubmissions.forEach((s) => {
      (s.answerDetails || []).forEach((a) => {
        const topic = questionTopicMap.get(`${s.quizId}:${a.questionId}`) || 'General';
        const entry = topicTotals.get(topic) || { correct: 0, total: 0 };
        entry.total += 1;
        if (a.isCorrect) entry.correct += 1;
        topicTotals.set(topic, entry);
      });
    });
    const topicAccuracy = Array.from(topicTotals.entries()).map(([topic, v]) => ({
      topic,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }));

    // Learners whose real average is below the school pass mark.
    const byLearner = new Map<
      string,
      { name: string; className: string; scores: number[]; topics: Set<string> }
    >();
    classSubmissions.forEach((s) => {
      const entry =
        byLearner.get(s.learnerId) ||
        { name: s.learnerName, className: s.className, scores: [], topics: new Set<string>() };
      entry.scores.push(s.percentage);
      (s.topicsToPractise || []).forEach((t) => entry.topics.add(t));
      byLearner.set(s.learnerId, entry);
    });

    const support = Array.from(byLearner.entries())
      .map(([id, entry]) => {
        const average = Math.round(
          entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length
        );
        return {
          id,
          name: entry.name,
          className: entry.className,
          currentAverage: `${average}%`,
          average,
          strugglingTopics: Array.from(entry.topics),
        };
      })
      .filter((l) => l.average < settings.defaultPassMark);

    return {
      quizPerformanceData: perf,
      topicAccuracyData: topicAccuracy,
      learnersNeedingSupport: support,
    };
  }, [selectedClass, settings.defaultPassMark]);

  const hasPerformanceData = quizPerformanceData.length > 0;
  const hasTopicData = topicAccuracyData.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classroom Learning Analytics & Revision Signals"
        subtitle="Objective performance data, topic accuracy breakdowns, and focused revision opportunities for your cohort."
      />

      {/* Filter Row */}
      <div className="bg-white border border-[#CBD5E1] p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1C2C5B]">
            Viewing Class:
          </span>
          <SelectField
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs py-1"
          >
            {classes.length === 0 && <option value="">No classes available</option>}
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.grade})
              </option>
            ))}
          </SelectField>
        </div>
        <span className="text-xs text-[#64748B]">
          {settings.currentTerm} — {settings.academicYear}
        </span>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Average by Quiz */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
              Class Average Across Quizzes
            </h3>
            <p className="text-xs text-[#64748B]">
              Mean scores per assessment compared with the {settings.defaultPassMark}% school pass benchmark
            </p>
          </div>

          {hasPerformanceData ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quizPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                  <XAxis dataKey="quiz" stroke="#64748B" fontSize={10} tickLine={false} />
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
                  <Bar dataKey="classAverage" name="Class Average (%)" fill="#1C2C5B" />
                  <Bar dataKey="benchmark" name="Target Benchmark (%)" fill="#CBD5E1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center border border-dashed border-[#CBD5E1] bg-[#F5F8FC]">
              <AlertCircle size={20} className="text-[#94A3B8] mb-2" />
              <p className="text-xs font-semibold text-[#64748B]">
                No marked submissions yet for this class.
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                Class averages appear once learners submit and results are graded.
              </p>
            </div>
          )}
        </div>

        {/* Topic-Level Accuracy */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
              Curriculum Topic Accuracy Breakdown
            </h3>
            <p className="text-xs text-[#64748B]">
              Percentage of learners correctly answering questions by topic tag
            </p>
          </div>

          {hasTopicData ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topicAccuracyData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 35, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis dataKey="topic" type="category" stroke="#64748B" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1C2C5B',
                      borderColor: '#1C2C5B',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="accuracy" name="Accuracy (%)" fill="#6CABDD" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center border border-dashed border-[#CBD5E1] bg-[#F5F8FC]">
              <AlertCircle size={20} className="text-[#94A3B8] mb-2" />
              <p className="text-xs font-semibold text-[#64748B]">
                No topic accuracy data available.
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                Topic breakdowns are derived from graded learner answers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Learners Needing Additional Support (Evidence-Based Observation) */}
      <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
        <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B] flex items-center gap-2">
            <AlertCircle size={16} className="text-[#1C2C5B]" />
            <span>Targeted Support Opportunities (Formative Observations)</span>
          </h3>
          <p className="text-xs text-[#64748B]">
            Learners whose recorded average is below the school pass mark. Derived from real quiz results.
          </p>
        </div>

        {learnersNeedingSupport.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-[#CBD5E1] bg-[#F5F8FC]">
            <p className="text-xs font-semibold text-[#64748B]">
              No learners currently below the pass mark in this class.
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-1">
              Support signals appear when submitted results fall below {settings.defaultPassMark}%.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {learnersNeedingSupport.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-[#F5F8FC] border border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-[#1C2C5B]">{item.name}</span>
                    <span className="font-mono text-[#64748B]">({item.id})</span>
                    <span className="bg-[#E8F3FC] text-[#1C2C5B] px-2 py-0.5 border border-[#6CABDD]/40 font-semibold">
                      Mean Score: {item.currentAverage}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[#64748B] font-semibold">Focus Topics:</span>
                    {item.strugglingTopics.length === 0 ? (
                      <span className="text-[#94A3B8]">None flagged</span>
                    ) : (
                      item.strugglingTopics.map((topic, i) => (
                        <span
                          key={i}
                          className="bg-white text-[#1C2C5B] border border-[#CBD5E1] px-2 py-0.5 text-[10px] font-medium"
                        >
                          {topic}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
