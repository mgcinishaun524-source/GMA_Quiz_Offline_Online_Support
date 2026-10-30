import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { FormField, InputField, SelectField } from '../../components/ui/FormControls';
import { appDataStore } from '../../services/storage';
import { directoryApiService } from '../../services/directory-api';
import { Teacher } from '../../types/learner';
import { Search, Plus, UserCheck, UserX, Edit2, X, GraduationCap } from 'lucide-react';

export const AdminTeachersPage: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>(appDataStore.getTeachers());
  const [classes, setClasses] = useState(appDataStore.getClasses());
  const [subjects, setSubjects] = useState(appDataStore.getSubjects());
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Subject Teacher' | 'Lead Teacher' | 'Head of Department'>('Subject Teacher');
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    void directoryApiService.hydrateDirectory();
    return appDataStore.subscribe(() => {
      setTeachers(appDataStore.getTeachers());
      setClasses(appDataStore.getClasses());
      setSubjects(appDataStore.getSubjects());
    });
  }, []);

  const openAddModal = () => {
    setEditingTeacher(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('Subject Teacher');
    setAssignedClasses([]);
    setAssignedSubjects([]);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (t: Teacher) => {
    setEditingTeacher(t);
    setName(t.name);
    setEmail(t.email);
    setPassword('');
    setRole(t.role);
    setAssignedClasses(t.assignedClasses || []);
    setAssignedSubjects(t.assignedSubjects || []);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !email.trim()) {
      setFormError('Name and email are required fields.');
      return;
    }
    if (!editingTeacher && password.length < 8) {
      setFormError('A password of at least 8 characters is required so the teacher can sign in.');
      return;
    }
    if (editingTeacher && password && password.length < 8) {
      setFormError('A new password must be at least 8 characters long.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTeacher) {
        await directoryApiService.updateTeacher(editingTeacher.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          assignedClasses,
          assignedSubjects,
          ...(password ? { password } : {}),
        });
      } else {
        await directoryApiService.createTeacher({
          name: name.trim(),
          email: email.trim(),
          role,
          assignedClasses,
          assignedSubjects,
          password,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save the teacher.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (t: Teacher) => {
    try {
      await directoryApiService.updateTeacher(t.id, { isActive: !t.isActive });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update the teacher status.');
    }
  };

  const filtered = teachers.filter((t) => {
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.role.toLowerCase().includes(q);
  });

  const columns: Column<Teacher>[] = [
    {
      header: 'Faculty Member',
      accessor: (t) => (
        <div>
          <span className="font-semibold text-xs text-[#0F172A] block">{t.name}</span>
          <span className="text-[11px] text-[#64748B] block font-mono">{t.email}</span>
        </div>
      ),
    },
    {
      header: 'Faculty Role',
      accessor: (t) => (
        <span className="text-xs font-medium text-[#1C2C5B] bg-[#E8F3FC] px-2 py-0.5 border border-[#6CABDD]/30">
          {t.role}
        </span>
      ),
    },
    {
      header: 'Assigned Classes',
      accessor: (t) => {
        const classNames = t.assignedClasses
          .map((id) => classes.find((c) => c.id === id)?.name || id)
          .join(', ');
        return <span className="text-xs text-[#0F172A]">{classNames || 'None'}</span>;
      },
    },
    {
      header: 'Subject Portfolio',
      accessor: (t) => {
        const subjNames = t.assignedSubjects
          .map((id) => subjects.find((s) => s.id === id)?.name || id)
          .join(', ');
        return <span className="text-xs text-[#64748B]">{subjNames || 'None'}</span>;
      },
    },
    {
      header: 'Status',
      accessor: (t) => <StatusLabel status={t.isActive ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openEditModal(t)}
            className="p-1.5 text-[#64748B] hover:text-[#1C2C5B] hover:bg-[#E8F3FC]"
            title="Edit Teacher"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleToggleActive(t)}
            className="p-1.5 text-[#64748B] hover:text-[#1C2C5B] hover:bg-[#E8F3FC]"
            title={t.isActive ? 'Deactivate' : 'Activate'}
          >
            {t.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Management & Subject Assignments"
        subtitle="Manage educators, pedagogical permissions, class assignments and curriculum domains."
        actions={
          <PrimaryButton onClick={openAddModal} icon={<Plus size={14} />}>
            Add Teacher
          </PrimaryButton>
        }
      />

      <div className="bg-white border border-[#CBD5E1] p-4 flex items-center justify-between shadow-xs">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <InputField
            type="text"
            placeholder="Search teachers by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <span className="text-xs text-[#64748B] font-medium">
          {filtered.length} faculty registered
        </span>
      </div>

      {formError && !isModalOpen && (
        <div className="p-2.5 bg-[#FEE2E2] border border-[#B91C1C]/30 text-[#B91C1C] text-xs font-medium">
          {formError}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(t) => t.id}
        emptyMessage="No teachers matching filter criteria."
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
          <div className="bg-white border border-[#CBD5E1] shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <h3 className="text-base font-bold uppercase tracking-wider text-[#1C2C5B]">
                {editingTeacher ? `Edit Faculty: ${editingTeacher.name}` : 'Add Faculty Member'}
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
              <FormField label="Full Name with Honorific" required>
                <InputField
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ms. A. Mokoena"
                  required
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Official School Email" required>
                  <InputField
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="firstname.lastname@gma.edu"
                    required
                  />
                </FormField>

                <FormField label="Staff Role / Level" required>
                  <SelectField
                    value={role}
                    onChange={(e) => setRole(e.target.value as Teacher['role'])}
                  >
                    <option value="Subject Teacher">Subject Teacher</option>
                    <option value="Lead Teacher">Lead Teacher</option>
                    <option value="Head of Department">Head of Department</option>
                  </SelectField>
                </FormField>
              </div>

              <FormField
                label={editingTeacher ? 'Reset Password (optional)' : 'Sign-in Password'}
                required={!editingTeacher}
                helperText={
                  editingTeacher
                    ? 'Leave blank to keep the current password.'
                    : 'At least 8 characters. The teacher signs in with this email and password.'
                }
              >
                <InputField
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingTeacher ? 'Leave blank to keep current' : 'Minimum 8 characters'}
                  autoComplete="new-password"
                  required={!editingTeacher}
                />
              </FormField>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#1C2C5B] mb-2">
                  Assigned Classes
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#F5F8FC] border border-[#CBD5E1] max-h-36 overflow-y-auto">
                  {classes.map((cls) => {
                    const isChecked = assignedClasses.includes(cls.id);
                    return (
                      <label key={cls.id} className="flex items-center gap-2 text-xs text-[#0F172A] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedClasses([...assignedClasses, cls.id]);
                            } else {
                              setAssignedClasses(assignedClasses.filter((id) => id !== cls.id));
                            }
                          }}
                          className="accent-[#1C2C5B]"
                        />
                        <span>{cls.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#1C2C5B] mb-2">
                  Assigned Subjects
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#F5F8FC] border border-[#CBD5E1] max-h-36 overflow-y-auto">
                  {subjects.map((s) => {
                    const isChecked = assignedSubjects.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-[#0F172A] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedSubjects([...assignedSubjects, s.id]);
                            } else {
                              setAssignedSubjects(assignedSubjects.filter((id) => id !== s.id));
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
                  {editingTeacher ? 'Update Faculty Details' : 'Save Faculty Member'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
