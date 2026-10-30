import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const PrimaryButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#6CABDD] hover:bg-[#589ac9] active:bg-[#488ac0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-[#6CABDD] shadow-xs cursor-pointer ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin inline-block" />
      )}
      {!isLoading && icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const SecondaryButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1C2C5B] hover:bg-[#152247] active:bg-[#0f1935] disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-[#1C2C5B] shadow-xs cursor-pointer ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin inline-block" />
      )}
      {!isLoading && icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const OutlineButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#1C2C5B] bg-white hover:bg-[#F5F8FC] active:bg-[#E8F3FC] border border-[#CBD5E1] hover:border-[#6CABDD] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-[#1C2C5B] border-t-transparent animate-spin inline-block" />
      )}
      {!isLoading && icon && <span className="inline-flex shrink-0 text-[#64748B]">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const DangerButton: React.FC<ButtonProps> = ({
  children,
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] active:bg-[#7F1D1D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-[#B91C1C] shadow-xs cursor-pointer ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin inline-block" />
      )}
      {!isLoading && icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
