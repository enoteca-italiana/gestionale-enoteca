import { useEffect, useMemo, useState } from 'react';
import { getBool, storageKeys } from '@/pages/admin/storage';
import { parseArchiveCsv, type ArchiveCsvWineInput } from '@/data/archiveCsv';
import type { AppDomain } from '@/app/appDomain';
import {
  appendWines,
  listWines,
  replaceAllWines,
  updateThresholdForAllWines
} from '@/data/wineRepository';
import { appendSpirits, listSpirits, replaceAllSpirits } from '@/data/spiritsRepository';
import { exportArchiveExcel, exportArchivePdf } from '@/pages/admina/utils/archiveExport';
import { sha256Base64 } from '@/pages/admin/crypto';

type ImportMode = 'replace' | 'append';

export type UseAdminSettingsOptions = {
  activeDomain: AppDomain;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  onHardReset: () => Promise<void>;
  openAction?: 'password' | 'import' | 'export' | 'threshold' | 'pinRequest' | 'reset' | null;
  onActionHandled?: () => void;
};

export function useAdminSettings({
  activeDomain,
  onChangePassword,
  onHardReset,
  openAction,
  onActionHandled
}: UseAdminSettingsOptions) {
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
      const entityLabel = activeDomain === 'wine' ? 'Vini' : 'Spirits';
      if (importMode === 'append') {
        if (activeDomain === 'wine') {
          await appendWines(importRows);
        } else {
          await appendSpirits(importRows);
        }
        setImportOk(`Import completato: aggiunti ${importRows.length} ${entityLabel}`);
      } else {
        if (activeDomain === 'wine') {
          await replaceAllWines(importRows);
        } else {
          await replaceAllSpirits(importRows);
        }
        setImportOk(`Import completato: ${importRows.length} ${entityLabel}`);
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
    if (activeDomain !== 'wine') {
      setThresholdPinError('Operazione disponibile solo in modalità Vini.');
      return;
    }
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
    setExportBusy(true);
    try {
      if (activeDomain === 'wine') {
        const wines = await listWines({ forceRemote: true });
        if (mode === 'excel') {
          await exportArchiveExcel(wines);
        } else {
          await exportArchivePdf(wines);
        }
      } else {
        const spirits = await listSpirits();
        if (mode === 'excel') {
          await exportArchiveExcel(spirits);
        } else {
          await exportArchivePdf(spirits);
        }
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Errore durante export archivio');
    } finally {
      setExportBusy(false);
    }
  };

  return {
    busy,
    pwdError,
    setPwdError,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    canChange,
    passwordModalOpen,
    setPasswordModalOpen,
    passwordConfirmOpen,
    setPasswordConfirmOpen,
    reset1,
    setReset1,
    reset2,
    setReset2,
    resetPin,
    setResetPin,
    resetPinError,
    setResetPinError,
    resetBusy,
    importFile,
    setImportFile,
    importRows,
    setImportRows,
    importBusy,
    importError,
    setImportError,
    importOk,
    setImportOk,
    importConfirm,
    setImportConfirm,
    importPinConfirm,
    setImportPinConfirm,
    importPin,
    setImportPin,
    importPinError,
    setImportPinError,
    importModalOpen,
    setImportModalOpen,
    exportModalOpen,
    setExportModalOpen,
    exportBusy,
    exportError,
    setExportError,
    importMode,
    setImportMode,
    thresholdModalOpen,
    setThresholdModalOpen,
    thresholdValue,
    setThresholdValue,
    thresholdError,
    setThresholdError,
    thresholdConfirm1,
    setThresholdConfirm1,
    thresholdConfirm2,
    setThresholdConfirm2,
    thresholdPin,
    setThresholdPin,
    thresholdPinError,
    setThresholdPinError,
    thresholdBusy,
    appPinModalOpen,
    setAppPinModalOpen,
    appPinRequiredOnStart,
    setAppPinRequiredOnStart,
    appPinRequiredForSettings,
    setAppPinRequiredForSettings,
    parseThresholdValue,
    changePassword,
    prepareImport,
    confirmImportWithPin,
    confirmBulkThresholdWithPin,
    confirmResetWithPin,
    handleExportArchive
  };
}
