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

/**
 * Shared button set for the redesigned GMA interface.
 *
 * Sky-inspired glassmorphism: navy primary actions, translucent white
 * secondary surfaces and a refined gold highlight that matches the school
 * crest. Sizing keeps a comfortable (≈40px) touch target, and every variant
 * preserves the same disabled/loading semantics as before.
 */

const base =
  'inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] text-sm ' +
  'rounded-xl transition-all duration-150 cursor-pointer ' +
  'focus-visible:outline-none disabled:opacity-55 disabled:cursor-not-allowed disabled:active:scale-100';

/* ── Primary — navy, white text ──────────────────────────────────────────── */
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
      ${base}
      font-semibold text-white
      bg-gma-navy hover:bg-gma-navy-deep active:bg-[#101A36] active:scale-[0.985]
      border border-[#16224A]/70
      shadow-[0_14px_30px_-16px_rgba(28,44,91,0.85),inset_0_1px_0_rgba(255,255,255,0.16)]
      hover:shadow-[0_18px_36px_-16px_rgba(28,44,91,0.9),inset_0_1px_0_rgba(255,255,255,0.2)]
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner /> : icon && <span className="inline-flex shrink-0">{icon}</span>}
    <span>{children}</span>
  </button>
);

/* ── Secondary / Outline — translucent white on glass ────────────────────── */
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
      ${base}
      font-medium text-gma-navy
      bg-white/80 hover:bg-white active:bg-gma-frost active:scale-[0.985]
      border border-gma-navy/20 hover:border-gma-navy/45
      shadow-[0_10px_26px_-20px_rgba(28,44,91,0.55)]
      backdrop-blur-sm
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner color="border-gma-navy" /> : icon && <span className="inline-flex shrink-0 text-gma-navy/75">{icon}</span>}
    <span>{children}</span>
  </button>
);

/* ── Secondary — solid navy (for dark-surface / header actions) ───────────── */
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
      ${base}
      font-semibold text-white
      bg-gma-navy hover:bg-gma-navy-deep active:bg-[#101A36] active:scale-[0.985]
      border border-[#16224A]/70
      shadow-[0_14px_30px_-16px_rgba(28,44,91,0.85),inset_0_1px_0_rgba(255,255,255,0.16)]
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner /> : icon && <span className="inline-flex shrink-0">{icon}</span>}
    <span>{children}</span>
  </button>
);

/* ── Gold — sparing brand highlight, matched to the school crest ─────────── */
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
      ${base}
      font-semibold text-[#3B2C08]
      bg-gma-gold hover:bg-[#C4941C] active:bg-[#B8891A] active:scale-[0.985]
      border border-[#C4941C]/70
      shadow-[0_14px_30px_-16px_rgba(184,137,26,0.75),inset_0_1px_0_rgba(255,255,255,0.35)]
      ${className}
    `}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading ? <Spinner color="border-[#3B2C08]" /> : icon && <span className="inline-flex shrink-0">{icon}</span>}
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
      ${base}
      font-semibold text-white
      bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-[0.985]
      border border-red-700/70
      shadow-[0_14px_30px_-18px_rgba(185,28,28,0.8)]
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
      inline-flex items-center justify-center w-9 h-9
      text-gma-navy/70 hover:text-gma-navy
      hover:bg-gma-navy/8 active:bg-gma-navy/15 active:scale-[0.95]
      rounded-xl border border-transparent hover:border-gma-navy/10
      transition-all duration-150 cursor-pointer
      ${className}
    `}
    {...props}
  >
    {icon}
  </button>
);
