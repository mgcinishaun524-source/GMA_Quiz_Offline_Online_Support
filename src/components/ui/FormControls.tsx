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
    <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-[#0B1F4B]">
      {label} {required && <span className="text-red-600">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
  </div>
);

const inputBase =
  'w-full px-3 py-2 text-sm bg-white text-slate-900 rounded-lg border transition-all duration-150 placeholder:text-slate-400';
const inputNormal = 'border-slate-300 focus:outline-none focus:border-[#0B1F4B] focus:ring-2 focus:ring-[#0B1F4B]/20';
const inputError  = 'border-red-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20';

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
