import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { OutlineButton, PrimaryButton } from '../../components/ui/Buttons';
import { appDataStore } from '../../services/storage';
import { ClassGroup, Learner } from '../../types/learner';
import { Quiz } from '../../types/quiz';
import { Users, Layers, BookOpen, Clock, CheckCircle2, ChevronRight, X } from 'lucide-react';

export const TeacherClassesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get('classId');

  const [classes, setClasses] = useState<ClassGroup[]>(appDataStore.getClasses());
  const [learners, setLearners] = useState<Learner[]>(appDataStore.getLearners());
  const [quizzes, setQuizzes] = useState<Quiz[]>(appDataStore.getQuizzes());
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialClassId || classes[0]?.id || ''
  );

  useEffect(() => {
    return appDataStore.subscribe(() => {
      setClasses(appDataStore.getClasses());
      setLearners(appDataStore.getLearners());
      setQuizzes(appDataStore.getQuizzes());
    });
  }, []);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const enrolledLearners = learners.filter((l) => l.classId === selectedClass?.id);
  const classQuizzes = quizzes.filter((q) => q.classId === selectedClass?.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assigned Classes & Cohort Rosters"
        subtitle="Review classroom attendance, student tablet credentials, and class-specific assessment performance."
      />

      {/* Class Selection Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gma-navy/10 pb-3">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClassId(cls.id)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
              selectedClass?.id === cls.id
                ? 'bg-gma-navy text-white border-gma-navy'
                : 'bg-white text-gma-muted border-gma-navy/10 hover:text-gma-navy hover:border-[gma-gold]'
            }`}
          >
            {cls.name} ({cls.grade})
          </button>
        ))}
      </div>

      {selectedClass && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class Summary Banner */}
          <div className="lg:col-span-3 gma-card rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[gma-gold]">
                {selectedClass.grade} Cohort
              </span>
              <h2 className="text-xl font-bold text-gma-navy">{selectedClass.name}</h2>
              <p className="text-xs text-gma-muted mt-1">
                Form Teacher: <strong className="text-[#0F172A]">{selectedClass.classTeacherName}</strong> •{' '}
                Location: <strong className="text-[#0F172A]">{selectedClass.room || 'Main Block'}</strong>
              </p>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-gma-muted block">Enrolled Learners</span>
                <span className="text-2xl font-extrabold text-gma-navy">
                  {enrolledLearners.length}
                </span>
              </div>
              <div className="border-l border-gma-navy/10 pl-6">
                <span className="text-gma-muted block">Assessments Run</span>
                <span className="text-2xl font-extrabold text-gma-navy">
                  {classQuizzes.length}
                </span>
              </div>
            </div>
          </div>

          {/* Left 2 Cols: Enrolled Learners Table */}
          <div className="lg:col-span-2 gma-card rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gma-navy/10">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gma-navy">
                Enrolled Student Roster ({enrolledLearners.length})
              </h3>
              <span className="text-xs text-gma-muted">Active tablet login credentials</span>
            </div>

            {enrolledLearners.length === 0 ? (
              <div className="p-8 text-center bg-gma-mist border border-dashed border-gma-navy/10 text-xs text-gma-muted">
                No students currently assigned to this class group.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gma-navy/95 text-white">
                      <th className="p-2.5 font-semibold uppercase">Learner ID</th>
                      <th className="p-2.5 font-semibold uppercase">Student Name</th>
                      <th className="p-2.5 font-semibold uppercase">Tablet PIN</th>
                      <th className="p-2.5 font-semibold uppercase">Status</th>
                      <th className="p-2.5 font-semibold uppercase text-right">Guardian Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gma-navy/8">
                    {enrolledLearners.map((learner) => (
                      <tr key={learner.id} className="hover:bg-gma-frost/60">
                        <td className="p-2.5 font-mono font-bold text-gma-navy">{learner.id}</td>
                        <td className="p-2.5 font-semibold text-[#0F172A]">
                          {learner.firstName} {learner.lastName}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-gma-muted">
                          {learner.pin}
                        </td>
                        <td className="p-2.5">
                          <StatusLabel status={learner.isActive ? 'active' : 'inactive'} />
                        </td>
                        <td className="p-2.5 text-right text-gma-muted">
                          {learner.guardianContact || 'None on file'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Col: Class Assessment History */}
          <div className="gma-card rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gma-navy/10">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gma-navy">
                Cohort Assessment History
              </h3>
              <span className="text-xs text-gma-muted">{classQuizzes.length} Total</span>
            </div>

            {classQuizzes.length === 0 ? (
              <div className="p-6 text-center bg-gma-mist border border-dashed border-gma-navy/10 text-xs text-gma-muted">
                No quizzes have been assigned to this cohort yet.
              </div>
            ) : (
              <div className="space-y-3">
                {classQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="p-3 bg-gma-mist border border-gma-navy/10 hover:border-[gma-gold] transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-xs text-gma-navy">{quiz.title}</span>
                      <StatusLabel status={quiz.status} />
                    </div>
                    <div className="text-[11px] text-gma-muted flex justify-between mt-2 pt-2 border-t border-gma-navy/10">
                      <span>{quiz.subjectName}</span>
                      <span>{quiz.questions.length} Questions</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
