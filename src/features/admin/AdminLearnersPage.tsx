import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { PrimaryButton, SecondaryButton, OutlineButton, DangerButton } from '../../components/ui/Buttons';
import { FormField, InputField, SelectField } from '../../components/ui/FormControls';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { appDataStore } from '../../services/storage';
import { learnerApiService } from '../../services/learner-api';
import { Learner } from '../../types/learner';
import { Search, Plus, UserCheck, UserX, Edit2, Trash2, Shield, Eye, X } from 'lucide-react';

export const AdminLearnersPage: React.FC = () => {
  const [learners, setLearners] = useState<Learner[]>(appDataStore.getLearners());
  const [classes, setClasses] = useState(appDataStore.getClasses());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLearner, setEditingLearner] = useState<Learner | null>(null);
  const [viewingLearner, setViewingLearner] = useState<Learner | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('Grade 3');
  const [classId, setClassId] = useState('');
  const [pin, setPin] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = appDataStore.subscribe(() => {
      setLearners(appDataStore.getLearners());
      setClasses(appDataStore.getClasses());
    });

    // Hydrate the directory from the server so enrollments persist beyond this browser.
    learnerApiService
      .fetchLearners()
      .then(() => {
        setLearners(appDataStore.getLearners());
        setClasses(appDataStore.getClasses());
      })
      .catch((err: unknown) => {
        setPageError(
          err instanceof Error ? err.message : 'Failed to load the learner directory from the server.'
        );
      });

    return unsubscribe;
  }, []);

  const openAddModal = () => {
    setFirstName('');
    setLastName('');
    setGrade('Grade 3');
    setClassId(classes[0]?.id || '');
    setPin(Math.floor(1000 + Math.random() * 9000).toString());
    setGuardianContact('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (learner: Learner) => {
    setEditingLearner(learner);
    setFirstName(learner.firstName);
    setLastName(learner.lastName);
    setGrade(learner.grade);
    setClassId(learner.classId);
    setPin(learner.pin || '');
    setGuardianContact(learner.guardianContact || '');
    setFormError('');
  };

  const handleSaveLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First and last names are required.');
      return;
    }
    if (!pin.trim() && !editingLearner) {
      setFormError('A 4-digit PIN is required for tablet sign-in.');
      return;
    }
    if (pin.trim() && !/^\d{4}$/.test(pin.trim())) {
      setFormError('The tablet PIN must consist of exactly 4 digits.');
      return;
    }

    const matchedClass = classes.find((c) => c.id === classId);
    const className = matchedClass ? matchedClass.name : 'Unassigned';

    setIsSaving(true);
    try {
      if (editingLearner) {
        await learnerApiService.updateLearner(editingLearner.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          grade,
          classId,
          className,
          pin: pin.trim(),
          guardianContact: guardianContact.trim(),
        });
        setEditingLearner(null);
      } else {
        await learnerApiService.createLearner({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          grade,
          classId,
          className,
          pin: pin.trim(),
          guardianContact: guardianContact.trim(),
        });
        setIsAddModalOpen(false);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save the learner.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (learner: Learner) => {
    setPageError('');
    try {
      await learnerApiService.updateLearner(learner.id, { isActive: !learner.isActive });
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : 'Failed to update the account status.');
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setPageError('');
    try {
      await learnerApiService.deleteLearner(deletingId);
      if (viewingLearner?.id === deletingId) setViewingLearner(null);
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : 'Failed to delete the learner record.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered List
  const filteredLearners = learners.filter((learner) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      learner.id.toLowerCase().includes(q) ||
      learner.firstName.toLowerCase().includes(q) ||
      learner.lastName.toLowerCase().includes(q);

    const matchesGrade = selectedGrade === 'ALL' || learner.grade === selectedGrade;
    const matchesClass = selectedClass === 'ALL' || learner.classId === selectedClass;

    return matchesSearch && matchesGrade && matchesClass;
  });

  const columns: Column<Learner>[] = [
    {
      header: 'Learner ID',
      accessor: (l) => <span className="font-mono font-bold text-xs text-[#1C2C5B]">{l.id}</span>,
    },
    {
      header: 'Full Name',
      accessor: (l) => (
        <div>
          <span className="font-semibold text-xs text-[#0F172A] block">
            {l.firstName} {l.lastName}
          </span>
          {l.guardianContact && (
            <span className="text-[11px] text-[#64748B] block">{l.guardianContact}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Grade & Class',
      accessor: (l) => (
        <span className="text-xs text-[#0F172A]">
          {l.grade} — {l.className}
        </span>
      ),
    },
    {
      header: 'Tablet PIN',
      accessor: (l) =>
        l.pin ? (
          <span className="font-mono text-xs text-[#64748B]">{l.pin}</span>
        ) : (
          <span className="text-xs text-[#94A3B8]" title="PIN is securely hashed and cannot be displayed">
            ••••
          </span>
        ),
    },
    {
      header: 'Account Status',
      accessor: (l) => <StatusLabel status={l.isActive ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      accessor: (l) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setViewingLearner(l)}
            className="p-1.5 text-[#64748B] hover:text-[#1C2C5B] hover:bg-[#E8F3FC] transition-colors"
            title="View Details"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => openEditModal(l)}
            className="p-1.5 text-[#64748B] hover:text-[#1C2C5B] hover:bg-[#E8F3FC] transition-colors"
            title="Edit Learner"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleToggleStatus(l)}
            className="p-1.5 text-[#64748B] hover:text-[#1C2C5B] hover:bg-[#E8F3FC] transition-colors"
            title={l.isActive ? 'Deactivate Account' : 'Activate Account'}
          >
            {l.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
          </button>
          <button
            onClick={() => setDeletingId(l.id)}
            className="p-1.5 text-[#64748B] hover:text-[#B91C1C] hover:bg-[#FEE2E2] transition-colors"
            title="Delete Record"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learner Directory & Enrollment"
        subtitle="Manage student tablet credentials, grade placements, and academic participation status."
        actions={
          <PrimaryButton onClick={openAddModal} icon={<Plus size={14} />}>
            Register Learner
          </PrimaryButton>
        }
      />

      {/* Server Synchronisation Error */}
      {pageError && (
        <div className="p-3 bg-[#FEE2E2] border border-[#B91C1C]/30 text-[#B91C1C] text-xs font-medium flex items-start justify-between gap-3">
          <span>{pageError}</span>
          <button
            onClick={() => setPageError('')}
            className="text-[#B91C1C] hover:text-[#7F1D1D] shrink-0"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white border border-[#CBD5E1] p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <InputField
            type="text"
            placeholder="Search by name or GMA ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-[#64748B] uppercase">Grade:</span>
            <SelectField
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="text-xs py-1"
            >
              <option value="ALL">All Grades</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4">Grade 4</option>
              <option value="Grade 5">Grade 5</option>
              <option value="Grade 6">Grade 6</option>
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

          <span className="text-xs text-[#64748B] font-medium border-l border-[#CBD5E1] pl-2.5">
            Showing {filteredLearners.length} learners
          </span>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredLearners}
        keyExtractor={(l) => l.id}
        emptyMessage="No learners found matching search and filter selections."
        onRowClick={(l) => setViewingLearner(l)}
      />

      {/* Add / Edit Learner Modal */}
      {(isAddModalOpen || editingLearner) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
          <div className="bg-white border border-[#CBD5E1] shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <h3 className="text-base font-bold uppercase tracking-wider text-[#1C2C5B]">
                {editingLearner ? `Edit Learner: ${editingLearner.id}` : 'Register New Learner'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingLearner(null);
                }}
                className="text-[#64748B] hover:text-[#1C2C5B]"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-2.5 bg-[#FEE2E2] border border-[#B91C1C]/30 text-[#B91C1C] text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveLearner} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="First Name" required>
                  <InputField
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    required
                  />
                </FormField>
                <FormField label="Last Name" required>
                  <InputField
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    required
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Academic Grade" required>
                  <SelectField value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="Grade 3">Grade 3</option>
                    <option value="Grade 4">Grade 4</option>
                    <option value="Grade 5">Grade 5</option>
                    <option value="Grade 6">Grade 6</option>
                  </SelectField>
                </FormField>

                <FormField label="Assigned Class" required>
                  <SelectField value={classId} onChange={(e) => setClassId(e.target.value)}>
                    {classes.length === 0 && <option value="">No classes available</option>}
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.grade})
                      </option>
                    ))}
                  </SelectField>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Tablet Sign-In PIN"
                  required={!editingLearner}
                  helperText={
                    editingLearner
                      ? 'Leave blank to keep the current PIN'
                      : '4 numeric digits for school tablets'
                  }
                >
                  <InputField
                    type="text"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="4821"
                    className="font-mono tracking-widest text-center"
                    required={!editingLearner}
                  />
                </FormField>

                <FormField label="Guardian Contact" helperText="Email or phone for progress reports">
                  <InputField
                    type="text"
                    value={guardianContact}
                    onChange={(e) => setGuardianContact(e.target.value)}
                    placeholder="parent@example.com"
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#CBD5E1]">
                <OutlineButton
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingLearner(null);
                  }}
                >
                  Cancel
                </OutlineButton>
                <PrimaryButton type="submit" isLoading={isSaving}>
                  {editingLearner ? 'Save Changes' : 'Complete Enrollment'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Learner Detail View Drawer/Modal */}
      {viewingLearner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
          <div className="bg-white border border-[#CBD5E1] shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#CBD5E1]">
              <div>
                <h3 className="text-base font-bold text-[#1C2C5B]">Learner Profile Card</h3>
                <span className="text-xs font-mono text-[#6CABDD] font-semibold">
                  {viewingLearner.id}
                </span>
              </div>
              <button
                onClick={() => setViewingLearner(null)}
                className="text-[#64748B] hover:text-[#1C2C5B]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-6">
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/40">
                <span className="text-[#64748B]">Full Name:</span>
                <span className="font-bold text-[#0F172A]">
                  {viewingLearner.firstName} {viewingLearner.lastName}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/40">
                <span className="text-[#64748B]">Grade Level:</span>
                <span className="font-semibold text-[#1C2C5B]">{viewingLearner.grade}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/40">
                <span className="text-[#64748B]">Assigned Class:</span>
                <span className="font-semibold text-[#0F172A]">{viewingLearner.className}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/40">
                <span className="text-[#64748B]">Tablet PIN:</span>
                <span className="font-mono font-bold text-[#1C2C5B]">
                  {viewingLearner.pin ? viewingLearner.pin : '•••• (hashed)'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/40">
                <span className="text-[#64748B]">Enrollment Date:</span>
                <span className="text-[#0F172A]">
                  {new Date(viewingLearner.enrolledDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#CBD5E1]/40">
                <span className="text-[#64748B]">Account Status:</span>
                <StatusLabel status={viewingLearner.isActive ? 'active' : 'inactive'} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <OutlineButton onClick={() => openEditModal(viewingLearner)}>
                Edit Learner
              </OutlineButton>
              <PrimaryButton onClick={() => setViewingLearner(null)}>Close</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete Learner Record"
        message="Are you certain you wish to remove this learner from Growing Minds Academy? This will revoke tablet credentials and remove enrollment links."
        confirmLabel="Confirm Deletion"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
