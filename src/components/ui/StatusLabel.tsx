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

/**
 * Status pill used across the redesigned interface.
 *
 * Sky blue leads (in-flight states), navy marks completed/confirmed records
 * and gold is reserved for a released/highlighted result — matching the
 * school crest. Never green.
 */
export const StatusLabel: React.FC<StatusLabelProps> = ({ status, variant, label, className = '' }) => {
  const norm = (variant || status || 'neutral').toLowerCase().replace(/\s+/g, '_');

  let colorClasses = 'bg-slate-100/80 text-slate-600 border-slate-200';
  let displayLabel = label || status;

  switch (norm) {
    case 'published':
    case 'in_progress':
      colorClasses = 'bg-gma-sky/15 text-[#2E6D9E] border-gma-sky/35 font-semibold';
      if (!label) displayLabel = norm === 'published' ? 'Published' : 'In Progress';
      break;
    case 'results_released':
      colorClasses = 'bg-gma-gold/18 text-[#8B6510] border-gma-gold/40 font-semibold';
      if (!label) displayLabel = 'Results Released';
      break;
    case 'closed':
      colorClasses = 'bg-slate-100/80 text-slate-600 border-slate-200';
      if (!label) displayLabel = 'Closed';
      break;
    case 'draft':
      colorClasses = 'bg-white/80 text-slate-500 border-slate-300 border-dashed';
      if (!label) displayLabel = 'Draft';
      break;
    case 'synced':
    case 'marked':
      colorClasses = 'bg-gma-navy/8 text-gma-navy border-gma-navy/20 font-semibold';
      if (!label) displayLabel = norm === 'synced' ? 'Synced' : 'Marked';
      break;
    case 'saved_offline':
    case 'pending_sync':
      colorClasses = 'bg-amber-50/90 text-amber-800 border-amber-300/70 font-semibold';
      if (!label) displayLabel = norm === 'saved_offline' ? 'Saved Offline' : 'Pending Sync';
      break;
    case 'submitted':
      colorClasses = 'bg-gma-frost/90 text-gma-navy border-gma-sky/25 font-medium';
      if (!label) displayLabel = 'Submitted';
      break;
    case 'active':
      colorClasses = 'bg-gma-sky/12 text-[#2E6D9E] border-gma-sky/30 font-semibold';
      if (!label) displayLabel = 'Active';
      break;
    case 'inactive':
      colorClasses = 'bg-slate-100/70 text-slate-400 border-slate-200';
      if (!label) displayLabel = 'Inactive';
      break;
    default:
      colorClasses = 'bg-slate-100/80 text-slate-600 border-slate-200';
  }

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        text-[0.68rem] font-semibold border
        rounded-full
        uppercase tracking-[0.09em]
        whitespace-nowrap
        ${colorClasses} ${className}
      `}
    >
      {displayLabel}
    </span>
  );
};
