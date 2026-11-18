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
        <div className="p-3 bg-gma-mist border border-gma-gold text-gma-navy text-xs font-semibold">
          Preferences saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
        <div className="gma-card rounded-2xl p-5">
          <div className="pb-3 mb-4 border-b border-gma-navy/10">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gma-navy flex items-center gap-2">
              <User size={16} className="text-gma-gold" />
              <span>Faculty Credentials & Roles</span>
            </h3>
            <p className="text-xs text-gma-muted">Personal details registered with Growing Minds Academy</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Staff Name">
              <InputField type="text" value={user?.name || ''} disabled />
            </FormField>
            <FormField label="Official School Email">
              <InputField type="email" value={user?.email || ''} disabled />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gma-navy/10 text-xs">
            <div>
              <span className="font-semibold text-gma-navy block mb-1">Assigned Classes:</span>
              <span className="text-[#0F172A] bg-gma-mist px-2.5 py-1 border border-gma-navy/10 inline-block">
                {user?.assignedClasses && user.assignedClasses.length > 0
                  ? user.assignedClasses.join(', ')
                  : 'None assigned'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gma-navy block mb-1">Subject Specialisations:</span>
              <span className="text-[#0F172A] bg-gma-mist px-2.5 py-1 border border-gma-navy/10 inline-block">
                {user?.assignedSubjects && user.assignedSubjects.length > 0
                  ? user.assignedSubjects.join(', ')
                  : 'None assigned'}
              </span>
            </div>
          </div>
        </div>

        {/* Assessment & Marking Preferences */}
        <div className="gma-card rounded-2xl p-5">
          <div className="pb-3 mb-4 border-b border-gma-navy/10">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gma-navy">
              Assessment & Notification Defaults
            </h3>
            <p className="text-xs text-gma-muted">Automation and submission alerts</p>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoMarkObjective}
                onChange={(e) => setAutoMarkObjective(e.target.checked)}
                className="accent-gma-navy"
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
                className="accent-gma-navy"
              />
              <span>
                <strong>Submission Alerts:</strong> Display non-intrusive status toast when tablet queues synchronize.
              </span>
            </label>
          </div>
        </div>

        {/* Local Storage & Device Status */}
        <div className="gma-card rounded-2xl p-5">
          <div className="pb-3 mb-4 border-b border-gma-navy/10">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gma-navy flex items-center gap-2">
              <Database size={16} className="text-gma-navy" />
              <span>Local Browser Cache & Offline Engine</span>
            </h3>
            <p className="text-xs text-gma-muted">Workstation cache integrity</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-gma-mist border border-gma-navy/10">
              <span className="text-gma-muted block">IndexedDB Database:</span>
              <span className="font-bold text-gma-navy">GMA_Offline_DB (v1)</span>
            </div>
            <div className="p-3 bg-gma-mist border border-gma-navy/10">
              <span className="text-gma-muted block">Service Worker:</span>
              <span className="font-bold text-gma-navy">Active (sw.js)</span>
            </div>
            <div className="p-3 bg-gma-mist border border-gma-navy/10">
              <span className="text-gma-muted block">Network Status:</span>
              <span className="font-bold text-gma-navy">
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
