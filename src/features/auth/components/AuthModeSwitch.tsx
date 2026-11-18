import React from 'react';
import { Backpack, GraduationCap } from 'lucide-react';

export type AuthMode = 'staff' | 'learner';

const MODES: { value: AuthMode; label: string; icon: React.ReactNode }[] = [
  { value: 'staff', label: 'Staff', icon: <GraduationCap size={16} strokeWidth={2.3} /> },
  { value: 'learner', label: 'Learner', icon: <Backpack size={16} strokeWidth={2.3} /> },
];

interface AuthModeSwitchProps {
  value: AuthMode;
  /** Called only when the selected mode actually changes. */
  onChange: (mode: AuthMode) => void;
}

/**
 * Accessible segmented control for choosing between staff and learner sign-in.
 *
 * Implements the ARIA tabs pattern (tablist/tab + roving tabindex) so the two
 * modes can be reached and switched with the arrow keys as well as the mouse.
 * The visual design is a navy "sliding pill" over a translucent track.
 */
export const AuthModeSwitch: React.FC<AuthModeSwitchProps> = ({ value, onChange }) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: AuthMode = value === 'staff' ? 'learner' : 'staff';
    onChange(next);
    document.getElementById(`gma-login-tab-${next}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Choose sign-in type"
      onKeyDown={handleKeyDown}
      className="relative grid grid-cols-2 gap-1.5 rounded-2xl border border-white/70 bg-white/55 p-1.5 shadow-[0_10px_30px_-18px_rgba(28,44,91,0.45)]"
    >
      {/* Sliding indicator. Container padding + gap are both 6px, so each
          column is exactly 50% − 9px wide and the second column sits 6px away. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1.5 top-1.5 bottom-1.5 w-[calc(50%-9px)] rounded-xl bg-gma-navy shadow-[0_10px_22px_-10px_rgba(28,44,91,0.9)] transition-transform duration-300 ease-out"
        style={{ transform: value === 'learner' ? 'translateX(calc(100% + 6px))' : 'translateX(0)' }}
      />

      {MODES.map((mode) => {
        const selected = value === mode.value;
        return (
          <button
            key={mode.value}
            id={`gma-login-tab-${mode.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`gma-login-panel-${mode.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(mode.value)}
            className={`relative z-10 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-[0.78rem] font-semibold tracking-wide transition-colors duration-200 cursor-pointer ${
              selected ? 'text-white' : 'text-gma-navy/70 hover:text-gma-navy'
            }`}
          >
            <span aria-hidden="true">{mode.icon}</span>
            <span className="truncate">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AuthModeSwitch;
