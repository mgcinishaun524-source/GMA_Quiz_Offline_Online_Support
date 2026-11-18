import React from 'react';

interface AuthSubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isLoading?: boolean;
}

/**
 * Primary call-to-action for the login screen.
 *
 * A login-scoped variant of the shared PrimaryButton: taller (48px touch
 * target), rounded and with a soft inner highlight, to match the premium
 * glass aesthetic. Keeps the same submit semantics — disabled + spinning
 * while a sign-in request is in flight.
 */
export const AuthSubmitButton: React.FC<AuthSubmitButtonProps> = ({
  children,
  isLoading,
  className = '',
  disabled,
  ...props
}) => (
  <button
    type="submit"
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    className={[
      'inline-flex h-12 min-h-[48px] w-full items-center justify-center gap-2',
      'rounded-xl border border-[#16224A]/60 bg-gma-navy px-5',
      'text-sm font-semibold tracking-wide text-white',
      'shadow-[0_18px_34px_-16px_rgba(28,44,91,0.85),inset_0_1px_0_rgba(255,255,255,0.18)]',
      'transition-all duration-200',
      'hover:bg-gma-navy-deep hover:shadow-[0_22px_40px_-16px_rgba(28,44,91,0.9),inset_0_1px_0_rgba(255,255,255,0.22)]',
      'active:scale-[0.985]',
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 disabled:hover:bg-gma-navy',
      'cursor-pointer',
      className,
    ].join(' ')}
    {...props}
  >
    {isLoading && (
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/70 border-t-transparent"
      />
    )}
    <span>{children}</span>
  </button>
);

export default AuthSubmitButton;
