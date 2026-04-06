import { useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { sha256Base64 } from '@/pages/admin/crypto';
import { storageKeys } from '@/pages/admin/storage';

type Props = {
  open: boolean;
  busy: boolean;
  filteredCount: number;
  categories: string[];
  onConfirm: (payload: { category?: string }) => Promise<void>;
  onCancel: () => void;
};

export function BulkEditFilteredModal({
  open,
  busy,
  filteredCount,
  categories,
  onConfirm,
  onCancel
}: Props) {
  const [targetAllFiltered, setTargetAllFiltered] = useState(true);
  const [categoryValue, setCategoryValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTargetAllFiltered(true);
    setCategoryValue('');
    setError(null);
    setConfirmOpen(false);
    setPinOpen(false);
    setPin('');
    setPinError(null);
  }, [open]);

  const canSubmit = useMemo(() => {
    if (!targetAllFiltered) return false;
    if (filteredCount <= 0) return false;
    return categoryValue.trim().length > 0;
  }, [categoryValue, filteredCount, targetAllFiltered]);

  if (!open) return null;

  const submit = async (): Promise<boolean> => {
    if (!canSubmit || busy) return false;
    try {
      await onConfirm({
        category: categoryValue.trim() || undefined
      });
      return true;
    } catch (err) {
      console.error('[BulkEditFilteredModal] confirm error', err);
      setError('Operazione bulk non riuscita. Riprova.');
      return false;
    }
  };

  const verifyPinAndSubmit = async () => {
    if (busy) return;
    setPinError(null);
    const storedHash = localStorage.getItem(storageKeys.adminPasswordHash);
    if (!storedHash) {
      setPinError('PIN admin non disponibile');
      return;
    }
    const pinHash = await sha256Base64(pin.trim());
    if (pinHash !== storedHash) {
      setPinError('PIN non corretto');
      return;
    }
    const ok = await submit();
    if (!ok) return;
    setPinOpen(false);
    setPin('');
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard adminSettingsModalCard">
        <div className="modalTitle">Modifica massiva (filtri attivi)</div>
        <div className="modalDescription">
          Applica una modifica in blocco ai vini attualmente visibili con i filtri correnti.
        </div>

        <div className="mt10">
          <label className="archiveBulkSelectAll">
            <input
              className="archiveBulkSelectAllCheckbox"
              type="checkbox"
              checked={targetAllFiltered}
              onChange={(event) => setTargetAllFiltered(event.target.checked)}
            />
            <span className="archiveBulkSelectAllLabel">
              Seleziona tutti i vini filtrati ({filteredCount})
            </span>
          </label>
        </div>

        <div className="mt12">
          <label className="modalLabel">
            Categoria da applicare
            <select
              className="input adminInput mt4"
              value={categoryValue}
              onChange={(event) => {
                setCategoryValue(event.target.value);
                if (error) setError(null);
              }}
            >
              <option value="">Seleziona categoria</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <div className="errorText mt10">{error}</div> : null}

        <div className="modalActions">
          <button
            className="button"
            type="button"
            disabled={!canSubmit || busy}
            onClick={() => setConfirmOpen(true)}
          >
            {busy ? 'Applico…' : 'Applica modifica'}
          </button>
          <button className="button buttonSecondary buttonCancel" type="button" onClick={onCancel}>
            Annulla
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        cardClassName="adminSettingsModalCard"
        title="Confermare modifica massiva?"
        description={`La categoria selezionata verrà applicata a ${filteredCount} vini filtrati.`}
        confirmLabel="Continua"
        cancelLabel="Annulla"
        onConfirm={() => {
          setConfirmOpen(false);
          setPinOpen(true);
          setPin('');
          setPinError(null);
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      {pinOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
            <div className="modalTitle">Conferma con PIN admin</div>
            <div className="modalDescription">
              Inserisci il PIN admin per applicare la modifica massiva.
            </div>
            <div className="mt12">
              <input
                className="input adminInput"
                type="password"
                inputMode="numeric"
                placeholder="Inserisci PIN admin"
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value);
                  if (pinError) setPinError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void verifyPinAndSubmit();
                }}
              />
            </div>
            {pinError ? <div className="errorText mt10">{pinError}</div> : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={busy || pin.trim().length === 0}
                onClick={() => void verifyPinAndSubmit()}
              >
                {busy ? 'Applico…' : 'Conferma e applica'}
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (busy) return;
                  setPinOpen(false);
                  setPin('');
                  setPinError(null);
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
