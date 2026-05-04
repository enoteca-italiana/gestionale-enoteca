type Props = {
  open: boolean;
  exportBusy: boolean;
  exportError: string | null;
  entityLabelPlural: string;
  onExport: (mode: 'excel' | 'pdf') => void;
  onClose: () => void;
};

export function ExportModal({
  open,
  exportBusy,
  exportError,
  entityLabelPlural,
  onExport,
  onClose
}: Props) {
  if (!open) return null;

  return (
    <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
      <div className="modalCard adminSettingsModalCard">
        <div className="modalTitle">Esporta archivio</div>
        <div className="modalDescription">
          {`Seleziona il formato di esportazione dell'archivio ${entityLabelPlural}.`}
        </div>
        {exportError ? <div className="errorText mt10">{exportError}</div> : null}
        <div className="modalActions">
          <button
            className="button"
            type="button"
            disabled={exportBusy}
            onClick={() => onExport('excel')}
          >
            {exportBusy ? 'Esportazione…' : 'Esporta Excel'}
          </button>
          <button
            className="button"
            type="button"
            disabled={exportBusy}
            onClick={() => onExport('pdf')}
          >
            {exportBusy ? 'Esportazione…' : 'Esporta PDF'}
          </button>
          <button
            className="button buttonSecondary buttonCancel"
            type="button"
            onClick={() => {
              if (exportBusy) return;
              onClose();
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
