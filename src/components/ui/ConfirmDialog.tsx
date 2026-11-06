import React from 'react';
import { OutlineButton, PrimaryButton, DangerButton } from './Buttons';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    /* Backdrop with subtle blur — glassmorphism only here */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={isLoading ? undefined : onCancel}
    >
      <div
        className="
          bg-white rounded-2xl shadow-2xl
          max-w-md w-full p-6
          animate-in fade-in zoom-in-95 duration-150
        "
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3
          id="confirm-dialog-title"
          className="text-lg font-bold text-[#0B1F4B]"
        >
          {title}
        </h3>
        <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <OutlineButton onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </OutlineButton>
          {isDestructive ? (
            <DangerButton onClick={onConfirm} isLoading={isLoading}>
              {confirmLabel}
            </DangerButton>
          ) : (
            <PrimaryButton onClick={onConfirm} isLoading={isLoading}>
              {confirmLabel}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
};
