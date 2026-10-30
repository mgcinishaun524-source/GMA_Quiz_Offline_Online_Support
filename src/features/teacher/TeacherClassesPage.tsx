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
      <div className="flex flex-wrap gap-2 border-b border-[#CBD5E1] pb-3">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClassId(cls.id)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
              selectedClass?.id === cls.id
                ? 'bg-[#1C2C5B] text-white border-[#1C2C5B]'
                : 'bg-white text-[#64748B] border-[#CBD5E1] hover:text-[#1C2C5B] hover:border-[#6CABDD]'
            }`}
          >
            {cls.name} ({cls.grade})
          </button>
        ))}
      </div>

      {selectedClass && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class Summary Banner */}
          <div className="lg:col-span-3 bg-white border border-[#CBD5E1] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6CABDD]">
                {selectedClass.grade} Cohort
              </span>
              <h2 className="text-xl font-bold text-[#1C2C5B]">{selectedClass.name}</h2>
              <p className="text-xs text-[#64748B] mt-1">
                Form Teacher: <strong className="text-[#0F172A]">{selectedClass.classTeacherName}</strong> •{' '}
                Location: <strong className="text-[#0F172A]">{selectedClass.room || 'Main Block'}</strong>
              </p>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-[#64748B] block">Enrolled Learners</span>
                <span className="text-2xl font-extrabold text-[#1C2C5B]">
                  {enrolledLearners.length}
                </span>
              </div>
              <div className="border-l border-[#CBD5E1] pl-6">
                <span className="text-[#64748B] block">Assessments Run</span>
                <span className="text-2xl font-extrabold text-[#1C2C5B]">
                  {classQuizzes.length}
                </span>
              </div>
            </div>
          </div>

          {/* Left 2 Cols: Enrolled Learners Table */}
          <div className="lg:col-span-2 bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
                Enrolled Student Roster ({enrolledLearners.length})
              </h3>
              <span className="text-xs text-[#64748B]">Active tablet login credentials</span>
            </div>

            {enrolledLearners.length === 0 ? (
              <div className="p-8 text-center bg-[#F5F8FC] border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">
                No students currently assigned to this class group.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1C2C5B] text-white">
                      <th className="p-2.5 font-semibold uppercase">Learner ID</th>
                      <th className="p-2.5 font-semibold uppercase">Student Name</th>
                      <th className="p-2.5 font-semibold uppercase">Tablet PIN</th>
                      <th className="p-2.5 font-semibold uppercase">Status</th>
                      <th className="p-2.5 font-semibold uppercase text-right">Guardian Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#CBD5E1]/60">
                    {enrolledLearners.map((learner) => (
                      <tr key={learner.id} className="hover:bg-[#F5F8FC]">
                        <td className="p-2.5 font-mono font-bold text-[#1C2C5B]">{learner.id}</td>
                        <td className="p-2.5 font-semibold text-[#0F172A]">
                          {learner.firstName} {learner.lastName}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-[#64748B]">
                          {learner.pin}
                        </td>
                        <td className="p-2.5">
                          <StatusLabel status={learner.isActive ? 'active' : 'inactive'} />
                        </td>
                        <td className="p-2.5 text-right text-[#64748B]">
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
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
                Cohort Assessment History
              </h3>
              <span className="text-xs text-[#64748B]">{classQuizzes.length} Total</span>
            </div>

            {classQuizzes.length === 0 ? (
              <div className="p-6 text-center bg-[#F5F8FC] border border-dashed border-[#CBD5E1] text-xs text-[#64748B]">
                No quizzes have been assigned to this cohort yet.
              </div>
            ) : (
              <div className="space-y-3">
                {classQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="p-3 bg-[#F5F8FC] border border-[#CBD5E1] hover:border-[#6CABDD] transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-xs text-[#1C2C5B]">{quiz.title}</span>
                      <StatusLabel status={quiz.status} />
                    </div>
                    <div className="text-[11px] text-[#64748B] flex justify-between mt-2 pt-2 border-t border-[#CBD5E1]/50">
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
