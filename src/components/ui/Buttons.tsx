import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
const Spinner: React.FC<{ color?: string }> = ({ color = 'border-white' }) => (
  <span
    className={`w-4 h-4 border-2 ${color} border-t-transparent rounded-full animate-spin inline-block shrink-0`}
    aria-hidden="true"
  />
);

/* ── Primary — Navy bg, white text ───────────────────────────────────────── */
export const PrimaryButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => (
  <button
    className={`
      inline-flex items-center justify-center gap-2
      px-4 py-2 min-h-[36px]
      text-sm font-semibold text-white
      bg-[#0B1F4B] hover:bg-[#142860] active:bg-[#091630] active:scale-[0.98]
      rounded-lg
      shadow-sm hover:shadow-md
      border border-[#0B1F4B]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
      transition-all duration-150
      cursor-pointer
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner /> : icon && <span className="inline-flex shrink-0">{icon}</span>}
    <span>{children}</span>
  </button>
);

/* ── Secondary / Outline — white bg, navy border ─────────────────────────── */
export const OutlineButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => (
  <button
    className={`
      inline-flex items-center justify-center gap-2
      px-4 py-2 min-h-[36px]
      text-sm font-medium text-[#0B1F4B]
      bg-white hover:bg-[#F7F7F4] active:bg-[#EEF0F8] active:scale-[0.98]
      rounded-lg
      border border-[#0B1F4B]/30 hover:border-[#0B1F4B]
      shadow-sm
      disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
      transition-all duration-150
      cursor-pointer
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner color="border-[#0B1F4B]" /> : icon && <span className="inline-flex shrink-0 text-[#0B1F4B]/70">{icon}</span>}
    <span>{children}</span>
  </button>
);

/* ── Secondary — solid navy (for header / dark-surface actions) ───────────── */
export const SecondaryButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => (
  <button
    className={`
      inline-flex items-center justify-center gap-2
      px-4 py-2 min-h-[36px]
      text-sm font-semibold text-white
      bg-[#0B1F4B] hover:bg-[#142860] active:bg-[#091630] active:scale-[0.98]
      rounded-lg
      shadow-sm hover:shadow-md
      border border-[#0B1F4B]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
      transition-all duration-150
      cursor-pointer
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner /> : icon && <span className="inline-flex shrink-0">{icon}</span>}
    <span>{children}</span>
  </button>
);

/* ── Gold — important / highlighted CTAs only ────────────────────────────── */
export const GoldButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => (
  <button
    className={`
      inline-flex items-center justify-center gap-2
      px-4 py-2 min-h-[36px]
      text-sm font-semibold text-[#0B1F4B]
      bg-[#D6A21E] hover:bg-[#C4941C] active:bg-[#B8891A] active:scale-[0.98]
      rounded-lg
      shadow-sm hover:shadow-md
      border border-[#D6A21E]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
      transition-all duration-150
      cursor-pointer
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner color="border-[#0B1F4B]" /> : icon && <span className="inline-flex shrink-0">{icon}</span>}
    <span>{children}</span>
  </button>
);

/* ── Danger — destructive actions ────────────────────────────────────────── */
export const DangerButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => (
  <button
    className={`
      inline-flex items-center justify-center gap-2
      px-4 py-2 min-h-[36px]
      text-sm font-medium text-white
      bg-red-700 hover:bg-red-800 active:bg-red-900 active:scale-[0.98]
      rounded-lg
      border border-red-700
      shadow-sm
      disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
      transition-all duration-150
      cursor-pointer
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner /> : icon && <span className="inline-flex shrink-0">{icon}</span>}
    <span>{children}</span>
  </button>
);

/* ── Icon-only button ────────────────────────────────────────────────────── */
export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: React.ReactNode }
> = ({ label, icon, className = '', ...props }) => (
  <button
    aria-label={label}
    title={label}
    className={`
      inline-flex items-center justify-center
      w-9 h-9
      text-[#0B1F4B]/70 hover:text-[#0B1F4B]
      hover:bg-[#0B1F4B]/8 active:bg-[#0B1F4B]/15 active:scale-[0.95]
      rounded-lg
      transition-all duration-150
      cursor-pointer
      ${className}
    `}
    {...props}
  >
    {icon}
  </button>
);
