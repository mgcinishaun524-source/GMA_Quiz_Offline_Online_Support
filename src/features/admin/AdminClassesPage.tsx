import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { FormField, InputField, SelectField } from '../../components/ui/FormControls';
import { appDataStore } from '../../services/storage';
import { directoryApiService } from '../../services/directory-api';
import { ClassGroup, Learner } from '../../types/learner';
import { Layers, Plus, Users, Edit2, X, BookOpen, MapPin } from 'lucide-react';

export const AdminClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassGroup[]>(appDataStore.getClasses());
  const [teachers, setTeachers] = useState(appDataStore.getTeachers());
  const [subjects, setSubjects] = useState(appDataStore.getSubjects());
  const [learners, setLearners] = useState<Learner[]>(appDataStore.getLearners());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [viewingClassLearners, setViewingClassLearners] = useState<ClassGroup | null>(null);

  // Form
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('Grade 3');
  const [classTeacherId, setClassTeacherId] = useState('');
  const [room, setRoom] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    void directoryApiService.hydrateDirectory();
    return appDataStore.subscribe(() => {
      setClasses(appDataStore.getClasses());
      setTeachers(appDataStore.getTeachers());
      setSubjects(appDataStore.getSubjects());
      setLearners(appDataStore.getLearners());
    });
  }, []);

  const openAddModal = () => {
    setEditingClass(null);
    setName('');
    setGrade('Grade 3');
    setClassTeacherId(teachers[0]?.id || '');
    setRoom('Room 10 - Main Wing');
    setSelectedSubjects(['subj-math', 'subj-sci', 'subj-eng']);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: ClassGroup) => {
    setEditingClass(c);
    setName(c.name);
    setGrade(c.grade);
    setClassTeacherId(c.classTeacherId);
    setRoom(c.room || '');
    setSelectedSubjects(c.subjectIds || []);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Class name is required (e.g. Grade 3C).');
      return;
    }

    const t = teachers.find((tch) => tch.id === classTeacherId);
    const teacherName = t ? t.name : 'Unassigned';

    const payload = {
      name: name.trim(),
      grade,
      classTeacherId,
      classTeacherName: teacherName,
      room: room.trim(),
      subjectIds: selectedSubjects,
    };

    setIsSaving(true);
    try {
      if (editingClass) {
        await directoryApiService.updateClass(editingClass.id, payload);
      } else {
        await directoryApiService.createClass(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save the class.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Roster & Cohort Management"
        subtitle="Manage academic class groups, form tutors, room assignments and enrolled learner rosters."
        actions={
          <PrimaryButton onClick={openAddModal} icon={<Plus size={14} />}>
            Create New Class
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => {
          const enrolled = learners.filter((l) => l.classId === cls.id);
          return (
            <div
              key={cls.id}
              className="bg-white border border-[#CBD5E1] p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#CBD5E1]/70">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6CABDD] block">
                      {cls.grade}
                    </span>
                    <h3 className="text-lg font-bold text-[#1C2C5B]">{cls.name}</h3>
                  </div>
                  <button
                    onClick={() => openEditModal(cls)}
                    className="p-1.5 text-[#64748B] hover:text-[#1C2C5B] hover:bg-[#E8F3FC] transition-colors"
                    title="Edit Class"
                  >
                    <Edit2 size={15} />
                  </button>
                </div>

                <div className="space-y-2 text-xs mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Class Form Teacher:</span>
                    <span className="font-semibold text-[#0F172A]">{cls.classTeacherName}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Assigned Room:</span>
                    <span className="text-[#0F172A] font-medium flex items-center gap-1">
                      <MapPin size={12} className="text-[#6CABDD]" />
                      {cls.room || 'General Classroom'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Curriculum Subjects:</span>
                    <span className="text-[#0F172A] font-medium">
                      {cls.subjectIds.length} Subjects
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#CBD5E1]/50">
                    <span className="text-[#64748B]">Enrolled Learners:</span>
                    <span className="font-bold text-[#1C2C5B] bg-[#E8F3FC] px-2 py-0.5 border border-[#6CABDD]/30">
                      {enrolled.length} Learners
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#CBD5E1]">
                <OutlineButton
                  onClick={() => setViewingClassLearners(cls)}
                  className="w-full text-xs py-1.5 justify-center"
                  icon={<Users size={13} />}
                >
                  View Enrolled Learners ({enrolled.length})
                </OutlineButton>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enrolled Learners Viewer Modal */}
      {viewingClassLearners && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
          <div className="bg-white border border-[#CBD5E1] shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <div>
                <h3 className="text-base font-bold text-[#1C2C5B]">
                  Roster: {viewingClassLearners.name} ({viewingClassLearners.grade})
                </h3>
                <p className="text-xs text-[#64748B]">
                  Form Teacher: {viewingClassLearners.classTeacherName}
                </p>
              </div>
              <button
                onClick={() => setViewingClassLearners(null)}
                className="text-[#64748B] hover:text-[#1C2C5B]"
              >
                <X size={18} />
              </button>
            </div>

            {learners.filter((l) => l.classId === viewingClassLearners.id).length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B] bg-[#F5F8FC] border border-dashed border-[#CBD5E1]">
                No learners currently enrolled in this class. Use Learner Registration to assign.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-[#CBD5E1]/60">
                {learners
                  .filter((l) => l.classId === viewingClassLearners.id)
                  .map((l) => (
                    <div key={l.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-[#0F172A] block">
                          {l.firstName} {l.lastName}
                        </span>
                        <span className="font-mono text-[11px] text-[#64748B]">{l.id}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-[#1C2C5B] bg-[#F5F8FC] px-1.5 py-0.5 border border-[#CBD5E1]">
                          PIN: {l.pin}
                        </span>
                        <span
                          className={`w-2 h-2 ${
                            l.isActive ? 'bg-[#1C2C5B]' : 'bg-[#CBD5E1]'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-end pt-4 mt-4 border-t border-[#CBD5E1]">
              <PrimaryButton onClick={() => setViewingClassLearners(null)}>Close Roster</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
          <div className="bg-white border border-[#CBD5E1] shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <h3 className="text-base font-bold uppercase tracking-wider text-[#1C2C5B]">
                {editingClass ? `Edit Class: ${editingClass.name}` : 'Create New Class Group'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] hover:text-[#1C2C5B]">
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-2.5 bg-[#FEE2E2] border border-[#B91C1C]/30 text-[#B91C1C] text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Class Name" required>
                  <InputField
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Grade 3C"
                    required
                  />
                </FormField>

                <FormField label="Grade Level" required>
                  <SelectField value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="Grade 3">Grade 3</option>
                    <option value="Grade 4">Grade 4</option>
                    <option value="Grade 5">Grade 5</option>
                    <option value="Grade 6">Grade 6</option>
                  </SelectField>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Assigned Form Teacher" required>
                  <SelectField
                    value={classTeacherId}
                    onChange={(e) => setClassTeacherId(e.target.value)}
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.role})
                      </option>
                    ))}
                  </SelectField>
                </FormField>

                <FormField label="Room Location">
                  <InputField
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. Room 12A"
                  />
                </FormField>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#1C2C5B] mb-2">
                  Curriculum Subjects Taught
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#F5F8FC] border border-[#CBD5E1] max-h-36 overflow-y-auto">
                  {subjects.map((s) => {
                    const isChecked = selectedSubjects.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-[#0F172A] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubjects([...selectedSubjects, s.id]);
                            } else {
                              setSelectedSubjects(selectedSubjects.filter((id) => id !== s.id));
                            }
                          }}
                          className="accent-[#1C2C5B]"
                        />
                        <span>{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD5E1]">
                <OutlineButton type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </OutlineButton>
                <PrimaryButton type="submit" isLoading={isSaving}>
                  {editingClass ? 'Save Changes' : 'Create Class'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
