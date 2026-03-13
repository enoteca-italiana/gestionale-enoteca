import { useEffect, useMemo, useState } from 'react';

type Props = {
  open: boolean;
  existingValues: string[];
  title?: string;
  inputPlaceholder?: string;
  similarTitle?: string;
  duplicateMessage?: string;
  ariaLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function isSimilarValue(input: string, candidate: string) {
  const a = normalizeText(input);
  const b = normalizeText(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));
  let overlap = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) overlap += 1;
  });
  return overlap > 0;
}

export function CategoryCreateModal({
  open,
  existingValues,
  title = 'Nuova categoria',
  inputPlaceholder = 'Inserisci nome categoria',
  similarTitle = 'Valori già presenti simili',
  duplicateMessage = 'Valore già esistente: se confermi, verrà riusato quello esistente.',
  ariaLabel = 'Nuovo valore',
  onCancel,
  onConfirm
}: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const normalized = useMemo(() => normalizeText(value), [value]);

  const similarValues = useMemo(() => {
    if (!normalized) return [];
    return existingValues.filter((item) => isSimilarValue(value, item)).slice(0, 8);
  }, [existingValues, normalized, value]);

  const hasExactDuplicate = useMemo(
    () => existingValues.some((item) => normalizeText(item) === normalized),
    [existingValues, normalized]
  );

  if (!open) return null;

  const canConfirm = value.trim().length > 0;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="modalCard archiveCategoryModalCard">
        <div className="modalTitle">{title}</div>

        <input
          className="input mt10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={inputPlaceholder}
          autoFocus
        />

        {similarValues.length > 0 ? (
          <div className="archiveCategoryHints mt10">
            <div className="archiveCategoryHintsTitle">{similarTitle}</div>
            <div className="archiveCategoryHintsList">
              {similarValues.map((item) => (
                <span key={item} className="archiveCategoryHintItem">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {hasExactDuplicate ? (
          <div className="archiveCategoryDuplicate mt10">{duplicateMessage}</div>
        ) : null}

        <div className="modalActions archiveModalActions">
          <button
            className="button buttonSecondary buttonCancel archiveModalActionButton"
            type="button"
            onClick={onCancel}
          >
            Annulla
          </button>
          <button
            className="button archiveModalActionButton"
            type="button"
            onClick={() => onConfirm(value)}
            disabled={!canConfirm}
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}
