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
    /* Translucent backdrop with blur — glassmodal */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gma-navy/35 backdrop-blur-sm"
      onClick={isLoading ? undefined : onCancel}
    >
      <div
        className="gma-glass gma-glass-strong rounded-[1.5rem] max-w-md w-full p-6 sm:p-7 shadow-gma-float"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3 id="confirm-dialog-title" className="text-lg font-extrabold tracking-tight text-gma-navy">
          {title}
        </h3>
        <p className="text-sm text-gma-muted mt-2 mb-6 leading-relaxed">{message}</p>
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
