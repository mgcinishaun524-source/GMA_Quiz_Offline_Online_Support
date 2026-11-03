import React from 'react';

export type StatusVariant =
  | 'draft'
  | 'published'
  | 'in_progress'
  | 'closed'
  | 'results_released'
  | 'submitted'
  | 'saved_offline'
  | 'pending_sync'
  | 'synced'
  | 'marked'
  | 'active'
  | 'inactive'
  | 'neutral';

interface StatusLabelProps {
  status: string;
  variant?: StatusVariant;
  label?: string;
  className?: string;
}

export const StatusLabel: React.FC<StatusLabelProps> = ({ status, variant, label, className = '' }) => {
  const norm = (variant || status || 'neutral').toLowerCase().replace(/\s+/g, '_');

  // NO GREEN. Navy, gold, amber, slate only.
  let colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
  let displayLabel = label || status;

  switch (norm) {
    case 'published':
    case 'in_progress':
      colorClasses = 'bg-[#0B1F4B]/8 text-[#0B1F4B] border-[#0B1F4B]/20 font-medium';
      if (!label) displayLabel = norm === 'published' ? 'Published' : 'In Progress';
      break;
    case 'results_released':
      colorClasses = 'bg-[#D6A21E]/15 text-[#8B6510] border-[#D6A21E]/30 font-semibold';
      if (!label) displayLabel = 'Results Released';
      break;
    case 'closed':
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
      if (!label) displayLabel = 'Closed';
      break;
    case 'draft':
      colorClasses = 'bg-white text-slate-500 border-slate-300 border-dashed';
      if (!label) displayLabel = 'Draft';
      break;
    case 'synced':
    case 'marked':
      colorClasses = 'bg-[#0B1F4B]/8 text-[#0B1F4B] border-[#0B1F4B]/20 font-medium';
      if (!label) displayLabel = norm === 'synced' ? 'Synced' : 'Marked';
      break;
    case 'saved_offline':
    case 'pending_sync':
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-200 font-medium';
      if (!label) displayLabel = norm === 'saved_offline' ? 'Saved Offline' : 'Pending Sync';
      break;
    case 'submitted':
      colorClasses = 'bg-[#0B1F4B]/6 text-[#0B1F4B] border-[#0B1F4B]/15';
      if (!label) displayLabel = 'Submitted';
      break;
    case 'active':
      colorClasses = 'bg-[#D6A21E]/10 text-[#8B6510] border-[#D6A21E]/25 font-medium';
      if (!label) displayLabel = 'Active';
      break;
    case 'inactive':
      colorClasses = 'bg-slate-100 text-slate-400 border-slate-200';
      if (!label) displayLabel = 'Inactive';
      break;
    default:
      colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        text-xs font-medium border
        rounded-full
        uppercase tracking-wider
        ${colorClasses} ${className}
      `}
    >
      {displayLabel}
    </span>
  );
};
