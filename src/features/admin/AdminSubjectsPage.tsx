import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { FormField, InputField, TextareaField } from '../../components/ui/FormControls';
import { appDataStore } from '../../services/storage';
import { directoryApiService } from '../../services/directory-api';
import { Subject } from '../../types/learner';
import { BookOpen, Plus, Edit2, X, Check } from 'lucide-react';

export const AdminSubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>(appDataStore.getSubjects());
  const [quizzes, setQuizzes] = useState(appDataStore.getQuizzes());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [topicCount, setTopicCount] = useState(10);
  const [description, setDescription] = useState('');
  const [gradeLevels, setGradeLevels] = useState<string[]>(['Grade 3', 'Grade 4']);
  const [formError, setFormError] = useState('');

  const ALL_GRADES = ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];

  useEffect(() => {
    void directoryApiService.fetchSubjects();
    return appDataStore.subscribe(() => {
      setSubjects(appDataStore.getSubjects());
      setQuizzes(appDataStore.getQuizzes());
    });
  }, []);

  const openAddModal = () => {
    setEditingSubject(null);
    setName('');
    setCode('');
    setTopicCount(10);
    setDescription('');
    setGradeLevels(['Grade 3', 'Grade 4']);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (s: Subject) => {
    setEditingSubject(s);
    setName(s.name);
    setCode(s.code);
    setTopicCount(s.topicCount);
    setDescription(s.description || '');
    setGradeLevels(s.gradeLevels);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !code.trim()) {
      setFormError('Subject name and code are required.');
      return;
    }

    // Duplicate check
    const duplicate = subjects.find(
      (s) =>
        s.code.toUpperCase() === code.trim().toUpperCase() &&
        (!editingSubject || s.id !== editingSubject.id)
    );
    if (duplicate) {
      setFormError(`Subject code "${code.trim().toUpperCase()}" is already assigned to ${duplicate.name}.`);
      return;
    }

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      topicCount: Number(topicCount),
      description: description.trim(),
      gradeLevels,
    };

    setIsSaving(true);
    try {
      if (editingSubject) {
        await directoryApiService.updateSubject(editingSubject.id, payload);
      } else {
        await directoryApiService.createSubject(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save the subject.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Subjects & Assessment Coverage"
        subtitle="Configure school learning domains, curriculum topics, and grade-level alignments."
        actions={
          <PrimaryButton onClick={openAddModal} icon={<Plus size={14} />}>
            Add Subject
          </PrimaryButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {subjects.map((subj) => {
          const associatedQuizzes = quizzes.filter((q) => q.subjectId === subj.id);
          return (
            <div
              key={subj.id}
              className="gma-card rounded-2xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gma-navy/10">
                  <div>
                    <span className="font-mono text-xs font-bold text-gma-gold uppercase tracking-wider block">
                      {subj.code}
                    </span>
                    <h3 className="text-base font-bold text-gma-navy">{subj.name}</h3>
                  </div>
                  <button
                    onClick={() => openEditModal(subj)}
                    className="p-1.5 text-gma-muted hover:text-gma-navy hover:bg-gma-mist transition-colors"
                    title="Edit Subject"
                  >
                    <Edit2 size={15} />
                  </button>
                </div>

                <p className="text-xs text-gma-muted mb-4 min-h-[36px] line-clamp-2">
                  {subj.description || 'Core curriculum learning area for elementary cohorts.'}
                </p>

                <div className="space-y-2 text-xs mb-4">
                  <div className="flex justify-between">
                    <span className="text-gma-muted">Curriculum Topics:</span>
                    <span className="font-bold text-[#0F172A]">{subj.topicCount} Topics</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gma-muted">Assessments Run:</span>
                    <span className="font-semibold text-gma-navy">
                      {associatedQuizzes.length} Quizzes
                    </span>
                  </div>
                  <div>
                    <span className="text-gma-muted block mb-1">Grade Level Coverage:</span>
                    <div className="flex flex-wrap gap-1">
                      {subj.gradeLevels.map((g) => (
                        <span
                          key={g}
                          className="bg-gma-mist text-gma-navy text-[10px] font-semibold px-2 py-0.5 border border-gma-gold/30"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gma-navy/10 text-[11px] text-gma-muted flex justify-between items-center">
                <span>Active in Syllabus</span>
                <span className="font-mono text-[10px] text-gma-navy font-bold">ST-ID: {subj.id}</span>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
          <div className="gma-card rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gma-navy/10">
              <h3 className="text-base font-bold uppercase tracking-wider text-gma-navy">
                {editingSubject ? `Edit Subject: ${editingSubject.name}` : 'Add Curriculum Subject'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gma-muted hover:text-gma-navy">
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
                <FormField label="Subject Title" required>
                  <InputField
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mathematics"
                    required
                  />
                </FormField>

                <FormField label="Subject Code" required helperText="e.g. MATH-PRI">
                  <InputField
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="MATH-PRI"
                    className="uppercase font-mono"
                    required
                  />
                </FormField>
              </div>

              <FormField label="Topic Count in Syllabus">
                <InputField
                  type="number"
                  min={1}
                  max={50}
                  value={topicCount}
                  onChange={(e) => setTopicCount(Number(e.target.value))}
                />
              </FormField>

              <FormField label="Subject Description & Objectives">
                <TextareaField
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Outline core competency standards for this curriculum subject..."
                />
              </FormField>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gma-navy mb-2">
                  Applicable Grade Levels
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_GRADES.map((g) => {
                    const isSelected = gradeLevels.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => {
                          if (isSelected) {
                            setGradeLevels(gradeLevels.filter((lvl) => lvl !== g));
                          } else {
                            setGradeLevels([...gradeLevels, g]);
                          }
                        }}
                        className={`px-3 py-1 text-xs font-semibold border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-gma-navy text-white border-gma-navy'
                            : 'bg-gma-mist text-gma-muted border-gma-navy/10 hover:text-gma-navy'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gma-navy/10">
                <OutlineButton type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </OutlineButton>
                <PrimaryButton type="submit" isLoading={isSaving}>
                  {editingSubject ? 'Save Changes' : 'Add Subject'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
