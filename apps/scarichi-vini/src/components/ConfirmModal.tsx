import type { ReactNode } from 'react';

export function ConfirmModal({
  open,
  title,
  description,
  titleCentered = false,
  descriptionCentered = false,
  cardClassName,
  overlayClassName,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  titleCentered?: boolean;
  descriptionCentered?: boolean;
  cardClassName?: string;
  overlayClassName?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className={`modalOverlay${overlayClassName ? ` ${overlayClassName}` : ''}`}
      role="dialog"
      aria-modal="true"
    >
      <div className={`modalCard${cardClassName ? ` ${cardClassName}` : ''}`}>
        <div className={`modalTitle${titleCentered ? ' centered' : ''}`}>{title}</div>
        {description ? (
          <div className={`modalDescription${descriptionCentered ? ' centered' : ''}`}>
            {description}
          </div>
        ) : null}
        <div className="modalActions">
          <button className="button" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="button buttonSecondary buttonCancel" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
