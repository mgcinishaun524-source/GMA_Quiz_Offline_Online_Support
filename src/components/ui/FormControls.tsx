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
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-[#1C2C5B]">
        {label} {required && <span className="text-[#B91C1C]">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-[#B91C1C] font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#64748B]">{helperText}</p>}
    </div>
  );
};

export const InputField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }
>(({ hasError, className = '', ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full px-3 py-2 text-sm bg-white text-[#0F172A] border ${
        hasError ? 'border-[#B91C1C]' : 'border-[#CBD5E1]'
      } focus:outline-hidden focus:border-[#6CABDD] focus:ring-1 focus:ring-[#6CABDD] placeholder:text-[#94A3B8] transition-colors ${className}`}
      {...props}
    />
  );
});
InputField.displayName = 'InputField';

export const SelectField = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }
>(({ hasError, className = '', children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={`w-full px-3 py-2 text-sm bg-white text-[#0F172A] border ${
        hasError ? 'border-[#B91C1C]' : 'border-[#CBD5E1]'
      } focus:outline-hidden focus:border-[#6CABDD] focus:ring-1 focus:ring-[#6CABDD] transition-colors cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});
SelectField.displayName = 'SelectField';

export const TextareaField = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }
>(({ hasError, className = '', ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={`w-full px-3 py-2 text-sm bg-white text-[#0F172A] border ${
        hasError ? 'border-[#B91C1C]' : 'border-[#CBD5E1]'
      } focus:outline-hidden focus:border-[#6CABDD] focus:ring-1 focus:ring-[#6CABDD] placeholder:text-[#94A3B8] transition-colors ${className}`}
      {...props}
    />
  );
});
TextareaField.displayName = 'TextareaField';
