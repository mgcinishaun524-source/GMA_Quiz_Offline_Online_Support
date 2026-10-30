import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { PrimaryButton } from '../../components/ui/Buttons';
import { FormField, InputField, SelectField } from '../../components/ui/FormControls';
import { appDataStore, SchoolSettings } from '../../services/storage';
import { School, Save } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SchoolSettings>(appDataStore.getSettings());
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    appDataStore.updateSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Settings & Assessment Policies"
        subtitle="Configure institution credentials, academic term calendars, assessment rules, and device sync defaults."
      />

      {isSaved && (
        <div className="p-3 bg-[#E8F3FC] border border-[#6CABDD] text-[#1C2C5B] text-xs font-semibold">
          School configuration and assessment rules updated successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* School Profile */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B] flex items-center gap-2">
              <School size={16} className="text-[#6CABDD]" />
              <span>Institutional Identity & Profile</span>
            </h3>
            <p className="text-xs text-[#64748B]">Official school name and accreditation details</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="School Name" required>
              <InputField
                type="text"
                value={settings.schoolName}
                onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                required
              />
            </FormField>

            <FormField label="School Motto / Mission Statement">
              <InputField
                type="text"
                value={settings.motto}
                onChange={(e) => setSettings({ ...settings, motto: e.target.value })}
              />
            </FormField>
          </div>
        </div>

        {/* Academic Calendar */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
              Academic Calendar & Assessment Window
            </h3>
            <p className="text-xs text-[#64748B]">Active school term and grading calendar</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Academic Year" required>
              <InputField
                type="text"
                value={settings.academicYear}
                onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Current Term" required>
              <SelectField
                value={settings.currentTerm}
                onChange={(e) => setSettings({ ...settings, currentTerm: e.target.value })}
              >
                <option value="Term 1">Term 1 (Autumn)</option>
                <option value="Term 2">Term 2 (Spring)</option>
                <option value="Term 3">Term 3 (Summer)</option>
              </SelectField>
            </FormField>

            <FormField label="Term Assessment Closing Date">
              <InputField
                type="date"
                value={settings.termEndDate}
                onChange={(e) => setSettings({ ...settings, termEndDate: e.target.value })}
              />
            </FormField>
          </div>
        </div>

        {/* Assessment Defaults */}
        <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs">
          <div className="pb-3 mb-4 border-b border-[#CBD5E1]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
              Default Assessment Policies & Offline Rules
            </h3>
            <p className="text-xs text-[#64748B]">
              Standard result release policies and offline tablet caching options
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              label="Default Result Release Policy"
              helperText="Can be overridden on individual quizzes"
            >
              <SelectField
                value={settings.defaultReleasePolicy}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultReleasePolicy: e.target.value as 'manual' | 'automatic',
                  })
                }
              >
                <option value="manual">Manual Release (Teacher Reviews & Approves)</option>
                <option value="automatic">Automatic Release (Upon Cohort Submission)</option>
              </SelectField>
            </FormField>

            <FormField
              label="Standard Pass Benchmark (%)"
              helperText="Baseline target for curriculum mastery"
            >
              <InputField
                type="number"
                min={40}
                max={90}
                value={settings.defaultPassMark}
                onChange={(e) => setSettings({ ...settings, defaultPassMark: Number(e.target.value) })}
              />
            </FormField>

            <FormField
              label="Tablet Offline Assessment Caching"
              helperText="Allows students to take tests without active Wi-Fi"
            >
              <SelectField
                value={settings.allowOfflineQuizzes ? 'true' : 'false'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allowOfflineQuizzes: e.target.value === 'true',
                  })
                }
              >
                <option value="true">Enabled (Permit Offline Tablet Assessments)</option>
                <option value="false">Disabled (Enforce Continuous Connection)</option>
              </SelectField>
            </FormField>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end pt-2">
          <PrimaryButton type="submit" icon={<Save size={14} />}>
            Save School Settings
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
};
