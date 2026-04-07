import { useEffect, useMemo, useState } from 'react';
import { getBool, setBool, storageKeys } from '@/pages/admin/storage';
import { ConfirmModal } from '@/components/ConfirmModal';
import { parseArchiveCsv, type ArchiveCsvWineInput } from '@/data/archiveCsv';
import { appendWines, listWines, replaceAllWines, updateThresholdForAllWines } from '@/data/wineRepository';
import { exportArchiveExcel, exportArchivePdf } from '@/pages/admina/utils/archiveExport';
import { sha256Base64 } from '@/pages/admin/crypto';

type ImportMode = 'replace' | 'append';

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
  onHardReset: () => Promise<void>;
  onBack?: () => void;
  openAction?: 'password' | 'import' | 'export' | 'threshold' | 'pinRequest' | 'reset' | null;
  onActionHandled?: () => void;
  hidePanel?: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
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
  const [importPinConfirm, setImportPinConfirm] = useState(false);
  const [importPin, setImportPin] = useState('');
  const [importPinError, setImportPinError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportBusyMode, setExportBusyMode] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);
  const [thresholdValue, setThresholdValue] = useState('');
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [thresholdConfirm1, setThresholdConfirm1] = useState(false);
  const [thresholdConfirm2, setThresholdConfirm2] = useState(false);
  const [thresholdPin, setThresholdPin] = useState('');
  const [thresholdPinError, setThresholdPinError] = useState<string | null>(null);
  const [thresholdBusy, setThresholdBusy] = useState(false);
  const [appPinModalOpen, setAppPinModalOpen] = useState(false);
  const [appPinRequiredOnStart, setAppPinRequiredOnStart] = useState<boolean>(() =>
    getBool(storageKeys.appPinRequiredOnStart, false)
  );
  const [appPinRequiredForSettings, setAppPinRequiredForSettings] = useState<boolean>(() =>
    getBool(storageKeys.appPinRequiredForSettings, false)
  );

  const canChange = useMemo(
    () =>
      currentPassword.length > 0 &&
      newPassword.length >= 4 &&
      confirmNewPassword.length >= 4 &&
      newPassword === confirmNewPassword,
    [confirmNewPassword, currentPassword, newPassword]
  );

  useEffect(() => {
    if (!openAction) return;
    if (openAction === 'password') {
      setPwdError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordModalOpen(true);
      onActionHandled?.();
      return;
    }
    if (openAction === 'import') {
      setImportError(null);
      setImportOk(null);
      setImportPin('');
      setImportPinError(null);
      setImportConfirm(false);
      setImportPinConfirm(false);
      setImportMode('replace');
      setImportModalOpen(true);
      onActionHandled?.();
      return;
    }
    if (openAction === 'export') {
      setExportError(null);
      setExportBusyMode(null);
      setExportModalOpen(true);
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
    if (openAction === 'pinRequest') {
      setAppPinRequiredOnStart(getBool(storageKeys.appPinRequiredOnStart, false));
      setAppPinRequiredForSettings(getBool(storageKeys.appPinRequiredForSettings, false));
      setAppPinModalOpen(true);
      onActionHandled?.();
      return;
    }
    if (openAction === 'reset') {
      setReset1(true);
      onActionHandled?.();
    }
  }, [onActionHandled, openAction]);

  const changePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      setPwdError('La conferma password non coincide');
      return;
    }
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
      setConfirmNewPassword('');
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

  const importArchive = async (): Promise<boolean> => {
    if (!importRows) return false;
    setImportBusy(true);
    setImportError(null);
    setImportOk(null);
    try {
      if (importMode === 'append') {
        await appendWines(importRows);
        setImportOk(`Import completato: aggiunti ${importRows.length} Vini`);
      } else {
        await replaceAllWines(importRows);
        setImportOk(`Import completato: ${importRows.length} Vini`);
      }
      setImportRows(null);
      setImportFile(null);
      setImportConfirm(false);
      return true;
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Errore durante import archivio');
      return false;
    } finally {
      setImportBusy(false);
    }
  };

  const confirmImportWithPin = async () => {
    if (importBusy) return;
    setImportPinError(null);
    setImportBusy(true);
    try {
      const storedHash = localStorage.getItem(storageKeys.adminPasswordHash);
      if (!storedHash) {
        setImportPinError('PIN admin non disponibile');
        return;
      }
      const pinHash = await sha256Base64(importPin.trim());
      if (pinHash !== storedHash) {
        setImportPinError('PIN non corretto');
        return;
      }
      const done = await importArchive();
      if (!done) {
        setImportPinConfirm(false);
        return;
      }
      setImportPinConfirm(false);
      setImportPin('');
      setImportPinError(null);
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
      try {
        await onHardReset();
        setReset2(false);
        setResetPin('');
      } catch (error) {
        setResetPinError(error instanceof Error ? error.message : 'Errore durante reset archivio');
      }
    } finally {
      setResetBusy(false);
    }
  };

  const handleExportArchive = async (mode: 'excel' | 'pdf') => {
    if (exportBusy) return;
    setExportError(null);
    setExportBusyMode(mode);
    setExportBusy(true);
    try {
      const wines = await listWines({ forceRemote: true });
      if (mode === 'excel') {
        await exportArchiveExcel(wines);
      } else {
        await exportArchivePdf(wines);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Errore durante export archivio");
    } finally {
      setExportBusy(false);
      setExportBusyMode(null);
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

      {appPinModalOpen ? (
        <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
            <div className="modalTitle centered">Richiesta PIN</div>
            <div className="adminPinToggleBlock">
              <div className="modalDescription centered">Richiesta PIN all&apos;avvio App.</div>
              <div className="adminPinSegmented" role="group" aria-label="Richiesta PIN avvio app">
                <button
                  className={`adminPinSegment adminPinSegmentOn ${appPinRequiredOnStart ? 'isActive' : ''}`}
                  type="button"
                  onClick={() => {
                    if (appPinRequiredOnStart) return;
                    setBool(storageKeys.appPinRequiredOnStart, true);
                    setAppPinRequiredOnStart(true);
                  }}
                >
                  ON
                </button>
                <button
                  className={`adminPinSegment adminPinSegmentOff ${!appPinRequiredOnStart ? 'isActive' : ''}`}
                  type="button"
                  onClick={() => {
                    if (!appPinRequiredOnStart) return;
                    setBool(storageKeys.appPinRequiredOnStart, false);
                    setAppPinRequiredOnStart(false);
                  }}
                >
                  OFF
                </button>
              </div>
            </div>
            <div className="adminPinToggleBlock">
              <div className="modalDescription centered">Richiesta PIN pagina IMPOSTAZIONI.</div>
              <div
                className="adminPinSegmented"
                role="group"
                aria-label="Richiesta PIN accesso pagina impostazioni"
              >
                <button
                  className={`adminPinSegment adminPinSegmentOn ${appPinRequiredForSettings ? 'isActive' : ''}`}
                  type="button"
                  onClick={() => {
                    if (appPinRequiredForSettings) return;
                    setBool(storageKeys.appPinRequiredForSettings, true);
                    setAppPinRequiredForSettings(true);
                  }}
                >
                  ON
                </button>
                <button
                  className={`adminPinSegment adminPinSegmentOff ${!appPinRequiredForSettings ? 'isActive' : ''}`}
                  type="button"
                  onClick={() => {
                    if (!appPinRequiredForSettings) return;
                    setBool(storageKeys.appPinRequiredForSettings, false);
                    setAppPinRequiredForSettings(false);
                  }}
                >
                  OFF
                </button>
              </div>
            </div>
            <div className="modalActions adminPinModalActions">
              <button
                className="button adminPinCloseButton"
                type="button"
                onClick={() => setAppPinModalOpen(false)}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {thresholdModalOpen ? (
        <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
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
        cardClassName="adminSettingsModalCard"
        overlayClassName="adminSettingsOverlay"
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
        <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
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
        cardClassName="adminSettingsModalCard"
        overlayClassName="adminSettingsOverlay"
        title="Reset archivio?"
        description="Verrà cancellato l'archivio vini su Supabase. Lo storico sessioni non verrà modificato."
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
        <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
            <div className="modalTitle">Conferma reset archivio</div>
            <div className="modalDescription">
              Inserisci il PIN admin per confermare l&apos;eliminazione definitiva
              dell&apos;archivio vini. Lo storico sessioni non verrà toccato.
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
                {resetBusy ? 'Verifica…' : 'Sì, reset archivio'}
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
        <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
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
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (pwdError) setPwdError(null);
                }}
              />
            </div>
            <div className="mt10">
              <input
                className="input adminInput"
                type="password"
                placeholder="Conferma nuova password"
                value={confirmNewPassword}
                onChange={(e) => {
                  setConfirmNewPassword(e.target.value);
                  if (pwdError) setPwdError(null);
                }}
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
                  setConfirmNewPassword('');
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importModalOpen ? (
        <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
            <div className={`modalTitle ${importOk ? 'centered' : ''}`}>Importa archivio CSV</div>
            {!importOk ? (
              <div className="modalDescription">
                La scelta tra aggiunta o sostituzione completa verrà richiesta succesivamente.
              </div>
            ) : null}

            {!importOk ? (
              <>
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
                {importFile ? (
                  <div className="subtle mt8">File selezionato: {importFile.name}</div>
                ) : null}
              </>
            ) : null}
            {importError ? <div className="errorText mt10">{importError}</div> : null}
            {importOk ? <div className="okText mt10 centered">{importOk}</div> : null}

            <div className="modalActions">
              {importOk ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    if (importBusy) return;
                    setImportModalOpen(false);
                    setImportConfirm(false);
                    setImportPinConfirm(false);
                    setImportPin('');
                    setImportPinError(null);
                  }}
                >
                  Chiudi
                </button>
              ) : (
                <>
                  <button
                    className={`button adminImportArchiveButton ${
                      importFile && !importBusy
                        ? 'adminImportArchiveButtonReady'
                        : 'adminImportArchiveButtonIdle'
                    }`}
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
                      setImportConfirm(false);
                      setImportPinConfirm(false);
                      setImportPin('');
                      setImportPinError(null);
                    }}
                  >
                    Annulla
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {exportModalOpen ? (
        <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
            <div className="modalTitle">Esporta archivio</div>
            <div className="modalDescription">
              Seleziona il formato di esportazione dell&apos;archivio vini.
            </div>
            {exportError ? <div className="errorText mt10">{exportError}</div> : null}
            <div className="modalActions">
              <button
                className="button adminExportExcelButton"
                type="button"
                disabled={exportBusy}
                onClick={() => void handleExportArchive('excel')}
              >
                {exportBusyMode === 'excel' ? 'Esportazione…' : 'Esporta Excel'}
              </button>
              <button
                className="button adminExportPdfButton"
                type="button"
                disabled={exportBusy}
                onClick={() => void handleExportArchive('pdf')}
              >
                {exportBusyMode === 'pdf' ? 'Esportazione…' : 'Esporta PDF'}
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (exportBusy) return;
                  setExportModalOpen(false);
                  setExportBusyMode(null);
                  setExportError(null);
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={passwordConfirmOpen}
        cardClassName="adminSettingsModalCard"
        overlayClassName="adminSettingsOverlay"
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
        cardClassName="adminSettingsModalCard adminImportModeConfirmCard"
        overlayClassName="adminSettingsOverlay"
        title="IMPORTANTE!"
        description={
          <div className="adminImportModeConfirmContent">
            <div className="adminImportModeConfirmMessage">
              Scegli come importare il file CSV
              {importRows ? ` (${importRows.length} record)` : ''}:
            </div>
            <div className="adminImportModeGroup" role="radiogroup" aria-label="Modalità import">
              <label className="adminImportModeOption">
                <input
                  type="radio"
                  name="admin-import-mode-confirm"
                  value="append"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                />
                <span>Aggiungi record ad archivio esistente</span>
              </label>
              <label className="adminImportModeOption">
                <input
                  type="radio"
                  name="admin-import-mode-confirm"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                />
                <span>Sostituisci intero archivio con il CSV</span>
              </label>
            </div>
          </div>
        }
        confirmLabel={importBusy ? 'Import in corso…' : 'Continua'}
        cancelLabel="Annulla"
        onConfirm={() => {
          if (importBusy) return;
          setImportConfirm(false);
          setImportPin('');
          setImportPinError(null);
          setImportPinConfirm(true);
        }}
        onCancel={() => {
          if (importBusy) return;
          setImportConfirm(false);
        }}
      />

      {importPinConfirm ? (
        <div className="modalOverlay adminSettingsOverlay" role="dialog" aria-modal="true">
          <div className="modalCard adminSettingsModalCard">
            <div className="modalTitle">Conferma import archivio</div>
            <div className="modalDescription">
              Inserisci il PIN admin per confermare
              {importMode === 'append'
                ? " l'aggiunta del CSV all'archivio esistente."
                : " la sostituzione completa dell'archivio con il CSV."}
            </div>
            <div className="mt12">
              <input
                className="input adminInput"
                type="password"
                inputMode="numeric"
                placeholder="Inserisci PIN admin"
                value={importPin}
                onChange={(e) => {
                  setImportPin(e.target.value);
                  if (importPinError) setImportPinError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void confirmImportWithPin();
                }}
              />
            </div>
            {importPinError ? <div className="errorText mt10">{importPinError}</div> : null}
            <div className="modalActions">
              <button
                className="button"
                type="button"
                disabled={importBusy || importPin.trim().length === 0}
                onClick={() => void confirmImportWithPin()}
              >
                {importBusy ? 'Verifica…' : 'Conferma import'}
              </button>
              <button
                className="button buttonSecondary buttonCancel"
                type="button"
                onClick={() => {
                  if (importBusy) return;
                  setImportPinConfirm(false);
                  setImportPin('');
                  setImportPinError(null);
                }}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
