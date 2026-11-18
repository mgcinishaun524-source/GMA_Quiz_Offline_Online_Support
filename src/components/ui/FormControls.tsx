import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required,
  children,
  id,
  className = '',
}) => (
  <div className={`space-y-1.5 ${className}`}>
    <label htmlFor={id} className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-gma-navy/80">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && (
      <p className="text-xs font-medium text-red-600" role="alert">
        {error}
      </p>
    )}
    {!error && helperText && <p className="text-xs text-gma-muted">{helperText}</p>}
  </div>
);

const inputBase =
  'w-full px-3.5 py-2.5 text-sm text-slate-900 rounded-xl border transition-all duration-150 ' +
  'placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] disabled:cursor-not-allowed disabled:opacity-60';
const inputNormal =
  'bg-white/80 border-gma-navy/15 hover:border-gma-navy/30 ' +
  'focus:outline-none focus:border-gma-sky focus:bg-white focus:ring-4 focus:ring-gma-sky/25';
const inputError =
  'bg-white/90 border-red-400 hover:border-red-500 ' +
  'focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20';

export const InputField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }
>(({ hasError, className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`${inputBase} ${hasError ? inputError : inputNormal} ${className}`}
    {...props}
  />
));
InputField.displayName = 'InputField';

export const SelectField = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }
>(({ hasError, className = '', children, ...props }, ref) => (
  <select
    ref={ref}
    className={`${inputBase} ${hasError ? inputError : inputNormal} cursor-pointer ${className}`}
    {...props}
  >
    {children}
  </select>
));
SelectField.displayName = 'SelectField';

export const TextareaField = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }
>(({ hasError, className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`${inputBase} ${hasError ? inputError : inputNormal} ${className}`}
    {...props}
  />
));
TextareaField.displayName = 'TextareaField';
