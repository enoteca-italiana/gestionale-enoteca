import { useEffect, useMemo, useState } from 'react';
import { storageKeys } from '@/pages/admin/storage';
import { ConfirmModal } from '@/components/ConfirmModal';
import { parseArchiveCsv, type ArchiveCsvWineInput } from '@/data/archiveCsv';
import { replaceAllWines, updateThresholdForAllWines } from '@/data/wineRepository';
import { sha256Base64 } from '@/pages/admin/crypto';

export function AdminSettings({
  onChangePassword,
  onLogout,
  onHardReset,
  onBack,
  openAction,
  onActionHandled,
  hidePanel = false
}: {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  onLogout: () => void;
  onHardReset: () => void;
  onBack?: () => void;
  openAction?: 'password' | 'import' | 'threshold' | 'reset' | null;
  onActionHandled?: () => void;
  hidePanel?: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [reset1, setReset1] = useState(false);
  const [reset2, setReset2] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetPinError, setResetPinError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ArchiveCsvWineInput[] | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importOk, setImportOk] = useState<string | null>(null);
  const [importConfirm, setImportConfirm] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);
  const [thresholdValue, setThresholdValue] = useState('');
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [thresholdConfirm1, setThresholdConfirm1] = useState(false);
  const [thresholdConfirm2, setThresholdConfirm2] = useState(false);
  const [thresholdPin, setThresholdPin] = useState('');
  const [thresholdPinError, setThresholdPinError] = useState<string | null>(null);
  const [thresholdBusy, setThresholdBusy] = useState(false);

  const canChange = useMemo(
    () => currentPassword.length > 0 && newPassword.length >= 4,
    [currentPassword, newPassword]
  );

  useEffect(() => {
    if (!openAction) return;
    if (openAction === 'password') {
      setPwdError(null);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordModalOpen(true);
      onActionHandled?.();
      return;
    }
    if (openAction === 'import') {
      setImportError(null);
      setImportOk(null);
      setImportModalOpen(true);
      onActionHandled?.();
      return;
    }
    if (openAction === 'threshold') {
      setThresholdError(null);
      setThresholdPinError(null);
      setThresholdPin('');
      setThresholdValue('');
      setThresholdModalOpen(true);
      onActionHandled?.();
      return;
    }
    if (openAction === 'reset') {
      setReset1(true);
      onActionHandled?.();
    }
  }, [onActionHandled, openAction]);

  const changePassword = async () => {
    setPwdError(null);
    setBusy(true);
    try {
      const ok = await onChangePassword(currentPassword, newPassword);
      if (!ok) {
        setPwdError('Password attuale non corretta');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setPasswordModalOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const prepareImport = async () => {
    if (!importFile) return;
    setImportError(null);
    setImportOk(null);
    try {
      const raw = await importFile.text();
      const rows = parseArchiveCsv(raw);
      if (rows.length === 0) {
        setImportError('Il file non contiene righe valide da importare');
        return;
      }
      setImportRows(rows);
      setImportConfirm(true);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Errore lettura CSV');
    }
  };

  const importArchive = async () => {
    if (!importRows) return;
    setImportBusy(true);
    setImportError(null);
    setImportOk(null);
    try {
      await replaceAllWines(importRows);
      setImportOk(`Import completato: ${importRows.length} record`);
      setImportRows(null);
      setImportFile(null);
      setImportConfirm(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Errore durante import archivio');
    } finally {
      setImportBusy(false);
    }
  };

  const parseThresholdValue = () => {
    const parsed = Number(thresholdValue.trim());
    if (!Number.isFinite(parsed)) return null;
    const rounded = Math.round(parsed);
    if (rounded < 1) return null;
    return rounded;
  };

  const confirmBulkThresholdWithPin = async () => {
    if (thresholdBusy) return;
    const nextThreshold = parseThresholdValue();
    if (nextThreshold === null) {
      setThresholdError('Inserisci una soglia valida (numero intero >= 1).');
      return;
    }
    setThresholdPinError(null);
    setThresholdBusy(true);
    try {
      const storedHash = localStorage.getItem(storageKeys.adminPasswordHash);
      if (!storedHash) {
        setThresholdPinError('PIN admin non disponibile');
        return;
      }
      const pinHash = await sha256Base64(thresholdPin.trim());
      if (pinHash !== storedHash) {
        setThresholdPinError('PIN non corretto');
        return;
      }
      await updateThresholdForAllWines(nextThreshold);
      setThresholdConfirm2(false);
      setThresholdModalOpen(false);
      setThresholdValue('');
      setThresholdPin('');
      setThresholdError(null);
      setThresholdPinError(null);
    } catch (error) {
      setThresholdPinError(
        error instanceof Error ? error.message : 'Errore durante aggiornamento soglie'
      );
    } finally {
      setThresholdBusy(false);
    }
  };

  const confirmResetWithPin = async () => {
    if (resetBusy) return;
    setResetPinError(null);
    setResetBusy(true);
    try {
      const storedHash = localStorage.getItem(storageKeys.adminPasswordHash);
      if (!storedHash) {
        setResetPinError('PIN admin non disponibile');
        return;
      }
      const pinHash = await sha256Base64(resetPin.trim());
      if (pinHash !== storedHash) {
        setResetPinError('PIN non corretto');
        return;
      }
      setReset2(false);
      setResetPin('');
      onHardReset();
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <>
      {!hidePanel ? (
        <div className="card adminCard adminSettingsSection">
          <div className="adminSettingsHeader">
            <div className="title">Impostazioni</div>
            <div className="adminSettingsActions">
              {onBack ? (
                <button
                  className="button buttonSecondary buttonAuto adminSettingsActionButton"
                  type="button"
                  onClick={onBack}
                >
                  Indietro
                </button>
              ) : null}
              <button
                className="button buttonSecondary buttonAuto adminSettingsActionButton"
                type="button"
                onClick={onLogout}
              >
                Esci
              </button>
            </div>
          </div>
          <div className="subtle mt6">Configurazioni operative locali.</div>
        </div>
      ) : null}

      {thresholdModalOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Imposta soglia unica</div>
            <div className="modalDescription">
              Imposta un valore soglia uguale per tutti i vini in archivio.
            </div>
            <div className="mt12">
              <input
                className="input adminInput"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="Inserisci soglia"
                value={thresholdValue}
                onChange={(e) => {
                  setThresholdValue(e.target.value);
                  if (thresholdError) setThresholdError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  const nextThreshold = parseThresholdValue();
                  if (nextThreshold === null) {
                    setThresholdError('Inserisci una soglia valida (numero intero >= 1).');
                    return;
                  }
                  setThresholdConfirm1(true);
                }}
              />
            </div>
            {thresholdError ? <div className="errorText mt10">{thresholdError}</div> : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  const nextThreshold = parseThresholdValue();
                  if (nextThreshold === null) {
                    setThresholdError('Inserisci una soglia valida (numero intero >= 1).');
                    return;
                  }
                  setThresholdConfirm1(true);
                }}
              >
                Applica soglia
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (thresholdBusy) return;
                  setThresholdModalOpen(false);
                  setThresholdConfirm1(false);
                  setThresholdConfirm2(false);
                  setThresholdValue('');
                  setThresholdPin('');
                  setThresholdError(null);
                  setThresholdPinError(null);
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={thresholdConfirm1}
        title="Confermare nuova soglia?"
        description={`Confermando, tutti i vini in archivio verranno aggiornati con la soglia ${
          parseThresholdValue() ?? 'selezionata'
        }.`}
        confirmLabel="Continua"
        cancelLabel="Annulla"
        onConfirm={() => {
          setThresholdConfirm1(false);
          setThresholdPin('');
          setThresholdPinError(null);
          setThresholdConfirm2(true);
        }}
        onCancel={() => setThresholdConfirm1(false)}
      />

      {thresholdConfirm2 ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Conferma modifica soglie</div>
            <div className="modalDescription">
              Inserisci il PIN admin per applicare la soglia a tutti i vini in archivio.
            </div>
            <div className="mt12">
              <input
                className="input adminInput"
                type="password"
                inputMode="numeric"
                placeholder="Inserisci PIN admin"
                value={thresholdPin}
                onChange={(e) => {
                  setThresholdPin(e.target.value);
                  if (thresholdPinError) setThresholdPinError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void confirmBulkThresholdWithPin();
                }}
              />
            </div>
            {thresholdPinError ? <div className="errorText mt10">{thresholdPinError}</div> : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={thresholdBusy || thresholdPin.trim().length === 0}
                onClick={() => void confirmBulkThresholdWithPin()}
              >
                {thresholdBusy ? 'Verifica…' : 'Sì, applica soglia'}
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (thresholdBusy) return;
                  setThresholdConfirm2(false);
                  setThresholdPin('');
                  setThresholdPinError(null);
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={reset1}
        title="Reset totale?"
        description="Verrà cancellato l'intero inventario, incluso lo storico. Azione definitiva."
        confirmLabel="Continua"
        cancelLabel="Annulla"
        onConfirm={() => {
          setReset1(false);
          setResetPin('');
          setResetPinError(null);
          setReset2(true);
        }}
        onCancel={() => setReset1(false)}
      />

      {reset2 ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Conferma reset definitivo</div>
            <div className="modalDescription">
              Inserisci il PIN admin per confermare l&apos;eliminazione definitiva di inventario e storico.
            </div>
            <div className="mt12">
              <input
                className="input adminInput"
                type="password"
                inputMode="numeric"
                placeholder="Inserisci PIN admin"
                value={resetPin}
                onChange={(e) => {
                  setResetPin(e.target.value);
                  if (resetPinError) setResetPinError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void confirmResetWithPin();
                }}
              />
            </div>
            {resetPinError ? <div className="errorText mt10">{resetPinError}</div> : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={resetBusy || resetPin.trim().length === 0}
                onClick={() => void confirmResetWithPin()}
              >
                {resetBusy ? 'Verifica…' : 'Sì, reset definitivo'}
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (resetBusy) return;
                  setReset2(false);
                  setResetPin('');
                  setResetPinError(null);
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordModalOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Aggiorna password admin</div>
            <div className="modalDescription">Inserisci password attuale e nuova password.</div>

            <div className="mt12">
              <input
                className="input adminInput"
                type="password"
                placeholder="Password attuale"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="mt10">
              <input
                className="input adminInput"
                type="password"
                placeholder="Nuova password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            {pwdError ? <div className="errorText mt10">{pwdError}</div> : null}

            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={!canChange || busy}
                onClick={() => setPasswordConfirmOpen(true)}
              >
                Conferma modifica
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (busy) return;
                  setPasswordModalOpen(false);
                  setPasswordConfirmOpen(false);
                  setPwdError(null);
                  setCurrentPassword('');
                  setNewPassword('');
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importModalOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Importa archivio CSV</div>
            <div className="modalDescription">
              Il CSV sostituirà completamente l&apos;archivio attuale.
            </div>

            <div className="mt12">
              <input
                className="input adminInput"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImportFile(file);
                  setImportRows(null);
                  setImportError(null);
                  setImportOk(null);
                }}
              />
            </div>
            {importFile ? <div className="subtle mt8">File selezionato: {importFile.name}</div> : null}
            {importError ? <div className="errorText mt10">{importError}</div> : null}
            {importOk ? <div className="okText mt10">{importOk}</div> : null}

            <div className="modalActions">
              <button
                className="button buttonSecondary"
                type="button"
                disabled={!importFile || importBusy}
                onClick={() => void prepareImport()}
              >
                Importa archivio
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (importBusy) return;
                  setImportModalOpen(false);
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={passwordConfirmOpen}
        title="Confermare aggiornamento password?"
        description="La password admin verrà modificata con il nuovo valore inserito."
        confirmLabel={busy ? 'Aggiornamento…' : 'Sì, aggiorna password'}
        cancelLabel="Annulla"
        onConfirm={() => {
          if (busy) return;
          void changePassword().finally(() => setPasswordConfirmOpen(false));
        }}
        onCancel={() => {
          if (busy) return;
          setPasswordConfirmOpen(false);
        }}
      />

      <ConfirmModal
        open={importConfirm}
        title="Confermare import archivio?"
        description={
          importRows
            ? `Verranno eliminati i record attuali e sostituiti con ${importRows.length} record dal CSV.`
            : 'Verranno eliminati i record attuali e sostituiti con il contenuto del CSV.'
        }
        confirmLabel={importBusy ? 'Import in corso…' : 'Sì, sostituisci archivio'}
        cancelLabel="Annulla"
        onConfirm={() => {
          if (importBusy) return;
          void importArchive().then(() => setImportConfirm(false));
        }}
        onCancel={() => {
          if (importBusy) return;
          setImportConfirm(false);
        }}
      />
    </>
  );
}
