import React, { useId } from 'react';

interface AuthTextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visible field label, associated to the input via htmlFor/id. */
  label: string;
  /** Leading icon (decorative — labelled by the field label). */
  icon?: React.ReactNode;
  /** Optional trailing control, e.g. the password/PIN visibility toggle. */
  trailing?: React.ReactNode;
  /** Helper text shown under the field when provided. */
  hint?: string;
}

/**
 * Refined glass-style input used by the redesigned login screen.
 *
 * Purely presentational: it owns no validation and does not change the
 * submitted value in any way. Long-standing input attributes
 * (type, value, onChange, autoComplete, maxLength, required…) are passed
 * straight through, so the existing authentication behaviour is unchanged.
 */
export const AuthTextField = React.forwardRef<HTMLInputElement, AuthTextFieldProps>(
  ({ label, icon, trailing, hint, id, className = '', ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? `gma-auth-field-${generatedId}`;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-gma-navy/80"
        >
          {label}
        </label>

        <div className="relative">
          {icon && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gma-navy/45"
            >
              {icon}
            </span>
          )}

          <input
            id={inputId}
            ref={ref}
            aria-describedby={hintId}
            className={[
              'h-12 w-full rounded-xl border bg-white/75 text-[0.95rem] text-slate-900',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-all duration-150',
              'placeholder:text-slate-400',
              icon ? 'pl-11' : 'pl-4',
              trailing ? 'pr-11' : 'pr-4',
              'border-gma-navy/12 hover:border-gma-navy/25',
              'focus:border-gma-sky focus:bg-white focus:outline-none focus:ring-4 focus:ring-gma-sky/25',
              'disabled:cursor-not-allowed disabled:opacity-60',
              className,
            ].join(' ')}
            {...props}
          />

          {trailing && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>
          )}
        </div>

        {hint && (
          <p id={hintId} className="text-xs text-slate-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
AuthTextField.displayName = 'AuthTextField';

export default AuthTextField;
