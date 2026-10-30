import React from 'react';
import { OutlineButton, PrimaryButton, DangerButton } from './Buttons';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
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
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
      <div className="bg-white border border-[#CBD5E1] shadow-lg max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-100">
        <h3 className="text-lg font-bold text-[#1C2C5B]">{title}</h3>
        <p className="text-sm text-[#64748B] mt-2 mb-6 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <OutlineButton onClick={onCancel}>{cancelLabel}</OutlineButton>
          {isDestructive ? (
            <DangerButton onClick={onConfirm}>{confirmLabel}</DangerButton>
          ) : (
            <PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
};
