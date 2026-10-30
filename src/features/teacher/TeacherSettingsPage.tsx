import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';
import { FormField, InputField } from '../../components/ui/FormControls';
import { useAuth } from '../../app/AuthContext';
import { syncQueueService } from '../../lib/sync-queue';
import { networkManager } from '../../lib/network';
import { User, BookOpen, Layers, Wifi, Database } from 'lucide-react';

export const TeacherSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifyOnSync, setNotifyOnSync] = useState(true);
  const [autoMarkObjective, setAutoMarkObjective] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Profile & Workspace Preferences"
        subtitle="Manage faculty account details, assigned curricula, and local workstation device settings."
      />

      {saved && (
        <div className="p-3 bg-[#E8F3FC] border border-[#6CABDD] text-[#1C2C5B] text-xs font-semibold">
          Preferences saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B] flex items-center gap-2">
              <User size={16} className="text-[#6CABDD]" />
              <span>Faculty Credentials & Roles</span>
            </h3>
            <p className="text-xs text-[#64748B]">Personal details registered with Growing Minds Academy</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Staff Name">
              <InputField type="text" value={user?.name || ''} disabled />
            </FormField>
            <FormField label="Official School Email">
              <InputField type="email" value={user?.email || ''} disabled />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#CBD5E1]/50 text-xs">
            <div>
              <span className="font-semibold text-[#1C2C5B] block mb-1">Assigned Classes:</span>
              <span className="text-[#0F172A] bg-[#F5F8FC] px-2.5 py-1 border border-[#CBD5E1] inline-block">
                {user?.assignedClasses && user.assignedClasses.length > 0
                  ? user.assignedClasses.join(', ')
                  : 'None assigned'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-[#1C2C5B] block mb-1">Subject Specialisations:</span>
              <span className="text-[#0F172A] bg-[#F5F8FC] px-2.5 py-1 border border-[#CBD5E1] inline-block">
                {user?.assignedSubjects && user.assignedSubjects.length > 0
                  ? user.assignedSubjects.join(', ')
                  : 'None assigned'}
              </span>
            </div>
          </div>
        </div>

        {/* Assessment & Marking Preferences */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
              Assessment & Notification Defaults
            </h3>
            <p className="text-xs text-[#64748B]">Automation and submission alerts</p>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMarkObjective}
                onChange={(e) => setAutoMarkObjective(e.target.checked)}
                className="accent-[#1C2C5B]"
              />
              <span>
                <strong>Automatic Objective Marking:</strong> Automatically grade multiple-choice and true/false questions against answer key upon submission.
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnSync}
                onChange={(e) => setNotifyOnSync(e.target.checked)}
                className="accent-[#1C2C5B]"
              />
              <span>
                <strong>Submission Alerts:</strong> Display non-intrusive status toast when tablet queues synchronize.
              </span>
            </label>
          </div>
        </div>

        {/* Local Storage & Device Status */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B] flex items-center gap-2">
              <Database size={16} className="text-[#1C2C5B]" />
              <span>Local Browser Cache & Offline Engine</span>
            </h3>
            <p className="text-xs text-[#64748B]">Workstation cache integrity</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-[#F5F8FC] border border-[#CBD5E1]">
              <span className="text-[#64748B] block">IndexedDB Database:</span>
              <span className="font-bold text-[#1C2C5B]">GMA_Offline_DB (v1)</span>
            </div>
            <div className="p-3 bg-[#F5F8FC] border border-[#CBD5E1]">
              <span className="text-[#64748B] block">Service Worker:</span>
              <span className="font-bold text-[#1C2C5B]">Active (sw.js)</span>
            </div>
            <div className="p-3 bg-[#F5F8FC] border border-[#CBD5E1]">
              <span className="text-[#64748B] block">Network Status:</span>
              <span className="font-bold text-[#1C2C5B]">
                {networkManager.isOnline() ? 'Connected' : 'Offline Mode'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <PrimaryButton type="submit">Save Preferences</PrimaryButton>
        </div>
      </form>
    </div>
  );
};
