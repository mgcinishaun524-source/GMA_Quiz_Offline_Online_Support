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

export const StatusLabel: React.FC<StatusLabelProps> = ({
  status,
  variant,
  label,
  className = '',
}) => {
  const norm = (variant || status || 'neutral').toLowerCase().replace(/\s+/g, '_');

  // STRICT RULE: ABSOLUTELY NO GREEN.
  // Using sky blue (#6CABDD), deep navy (#1C2C5B), pale blue (#E8F3FC), neutral slate (#475569), amber (#B45309).
  let colorClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
  let displayLabel = label || status;

  switch (norm) {
    case 'published':
    case 'in_progress':
      colorClasses = 'bg-[#E8F3FC] text-[#1C2C5B] border-[#6CABDD]/40 font-medium';
      if (!label) displayLabel = norm === 'published' ? 'Published' : 'In Progress';
      break;

    case 'results_released':
      colorClasses = 'bg-[#1C2C5B] text-[#FFFFFF] border-[#1C2C5B] font-medium';
      if (!label) displayLabel = 'Results Released';
      break;

    case 'closed':
      colorClasses = 'bg-[#F1F5F9] text-[#0F172A] border-[#CBD5E1]';
      if (!label) displayLabel = 'Closed';
      break;

    case 'draft':
      colorClasses = 'bg-[#FFFFFF] text-[#64748B] border-[#CBD5E1] border-dashed';
      if (!label) displayLabel = 'Draft';
      break;

    case 'synced':
    case 'marked':
      colorClasses = 'bg-[#E8F3FC] text-[#1C2C5B] border-[#6CABDD]/50 font-medium';
      if (!label) displayLabel = norm === 'synced' ? 'Synced with School' : 'Marked';
      break;

    case 'saved_offline':
    case 'pending_sync':
      colorClasses = 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/30 font-medium';
      if (!label) displayLabel = norm === 'saved_offline' ? 'Saved Offline' : 'Pending Sync';
      break;

    case 'submitted':
      colorClasses = 'bg-[#E8F3FC] text-[#1C2C5B] border-[#CBD5E1]';
      if (!label) displayLabel = 'Submitted';
      break;

    case 'active':
      colorClasses = 'bg-[#E8F3FC] text-[#1C2C5B] border-[#6CABDD]/40 font-medium';
      if (!label) displayLabel = 'Active';
      break;

    case 'inactive':
      colorClasses = 'bg-[#F1F5F9] text-[#94A3B8] border-[#CBD5E1]';
      if (!label) displayLabel = 'Inactive';
      break;

    default:
      colorClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
  }

  // Rectangular badge with subtle border, no pill, no circled icon
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border uppercase tracking-wider ${colorClasses} ${className}`}
    >
      {displayLabel}
    </span>
  );
};
