import type { ReactNode } from 'react';

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div className="modalTitle">{title}</div>
        {description ? <div className="modalDescription">{description}</div> : null}
        <div className="modalActions">
          <button className="button" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="button buttonSecondary" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
