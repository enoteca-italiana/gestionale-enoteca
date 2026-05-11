import { setBool, storageKeys } from '@/pages/admin/storage';
import { PasswordModal } from './settings/PasswordModal';
import { PinRequestModal } from './settings/PinRequestModal';
import { ThresholdModal } from './settings/ThresholdModal';
import { ResetModal } from './settings/ResetModal';
import { ImportModal } from './settings/ImportModal';
import { ExportModal } from './settings/ExportModal';
import { useAdminSettings } from '@/pages/admin/useAdminSettings';
import type { AppDomain } from '@/app/appDomainContext';

export function AdminSettings({
  onChangePassword,
  onLogout,
  onHardReset,
  activeDomain,
  onBack,
  openAction,
  onActionHandled,
  hidePanel = false
}: {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  onLogout: () => void;
  onHardReset: () => Promise<void>;
  activeDomain: AppDomain;
  onBack?: () => void;
  openAction?: 'password' | 'import' | 'export' | 'threshold' | 'pinRequest' | 'reset' | null;
  onActionHandled?: () => void;
  hidePanel?: boolean;
}) {
  const {
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
  } = useAdminSettings({
    activeDomain,
    onChangePassword,
    onHardReset,
    openAction,
    onActionHandled
  });

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

      <PinRequestModal
        open={appPinModalOpen}
        appPinRequiredOnStart={appPinRequiredOnStart}
        appPinRequiredForSettings={appPinRequiredForSettings}
        onSetPinOnStart={(value) => {
          setBool(storageKeys.appPinRequiredOnStart, value);
          setAppPinRequiredOnStart(value);
        }}
        onSetPinForSettings={(value) => {
          setBool(storageKeys.appPinRequiredForSettings, value);
          setAppPinRequiredForSettings(value);
        }}
        onClose={() => setAppPinModalOpen(false)}
      />

      <ThresholdModal
        entityLabelPlural={activeDomain === 'wine' ? 'vini' : 'spirits'}
        open={thresholdModalOpen}
        thresholdValue={thresholdValue}
        thresholdError={thresholdError}
        thresholdConfirm1={thresholdConfirm1}
        thresholdConfirm2={thresholdConfirm2}
        thresholdPin={thresholdPin}
        thresholdPinError={thresholdPinError}
        thresholdBusy={thresholdBusy}
        parsedThreshold={parseThresholdValue()}
        onThresholdValueChange={(v) => {
          setThresholdValue(v);
          if (thresholdError) setThresholdError(null);
        }}
        onRequestConfirm1={() => {
          const nextThreshold = parseThresholdValue();
          if (nextThreshold === null) {
            setThresholdError('Inserisci una soglia valida (numero intero >= 1).');
            return;
          }
          setThresholdConfirm1(true);
        }}
        onConfirm1={() => {
          setThresholdConfirm1(false);
          setThresholdPin('');
          setThresholdPinError(null);
          setThresholdConfirm2(true);
        }}
        onCancelConfirm1={() => setThresholdConfirm1(false)}
        onThresholdPinChange={(v) => {
          setThresholdPin(v);
          if (thresholdPinError) setThresholdPinError(null);
        }}
        onConfirmWithPin={() => void confirmBulkThresholdWithPin()}
        onCancelConfirm2={() => {
          if (thresholdBusy) return;
          setThresholdConfirm2(false);
          setThresholdPin('');
          setThresholdPinError(null);
        }}
        onClose={() => {
          if (thresholdBusy) return;
          setThresholdModalOpen(false);
          setThresholdConfirm1(false);
          setThresholdConfirm2(false);
          setThresholdValue('');
          setThresholdPin('');
          setThresholdError(null);
          setThresholdPinError(null);
        }}
      />

      <ResetModal
        reset1={reset1}
        reset2={reset2}
        resetPin={resetPin}
        resetPinError={resetPinError}
        resetBusy={resetBusy}
        onConfirmReset1={() => {
          setReset1(false);
          setResetPin('');
          setResetPinError(null);
          setReset2(true);
        }}
        onCancelReset1={() => setReset1(false)}
        onResetPinChange={(v) => {
          setResetPin(v);
          if (resetPinError) setResetPinError(null);
        }}
        onConfirmWithPin={() => void confirmResetWithPin()}
        onCancelReset2={() => {
          if (resetBusy) return;
          setReset2(false);
          setResetPin('');
          setResetPinError(null);
        }}
      />

      <PasswordModal
        open={passwordModalOpen}
        busy={busy}
        pwdError={pwdError}
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmNewPassword={confirmNewPassword}
        canChange={canChange}
        passwordConfirmOpen={passwordConfirmOpen}
        onCurrentPasswordChange={(v) => setCurrentPassword(v)}
        onNewPasswordChange={(v) => {
          setNewPassword(v);
          if (pwdError) setPwdError(null);
        }}
        onConfirmNewPasswordChange={(v) => {
          setConfirmNewPassword(v);
          if (pwdError) setPwdError(null);
        }}
        onClose={() => {
          if (busy) return;
          setPasswordModalOpen(false);
          setPasswordConfirmOpen(false);
          setPwdError(null);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        }}
        onRequestConfirm={() => setPasswordConfirmOpen(true)}
        onConfirm={() => {
          if (busy) return;
          void changePassword().finally(() => setPasswordConfirmOpen(false));
        }}
        onCancelConfirm={() => {
          if (busy) return;
          setPasswordConfirmOpen(false);
        }}
      />

      <ImportModal
        open={importModalOpen}
        importFile={importFile}
        importRows={importRows}
        importBusy={importBusy}
        importError={importError}
        importOk={importOk}
        importConfirm={importConfirm}
        importPinConfirm={importPinConfirm}
        importPin={importPin}
        importPinError={importPinError}
        importMode={importMode}
        onFileChange={(file) => {
          setImportFile(file);
          setImportRows(null);
          setImportError(null);
          setImportOk(null);
        }}
        onPrepareImport={() => void prepareImport()}
        onImportModeChange={setImportMode}
        onConfirmImportMode={() => {
          setImportConfirm(false);
          setImportPin('');
          setImportPinError(null);
          setImportPinConfirm(true);
        }}
        onCancelImportConfirm={() => setImportConfirm(false)}
        onImportPinChange={(v) => {
          setImportPin(v);
          if (importPinError) setImportPinError(null);
        }}
        onConfirmWithPin={() => void confirmImportWithPin()}
        onCancelPinConfirm={() => {
          setImportPinConfirm(false);
          setImportPin('');
          setImportPinError(null);
        }}
        onClose={() => {
          if (importBusy) return;
          setImportModalOpen(false);
          setImportConfirm(false);
          setImportPinConfirm(false);
          setImportPin('');
          setImportPinError(null);
        }}
      />

      <ExportModal
        open={exportModalOpen}
        exportBusy={exportBusy}
        exportError={exportError}
        entityLabelPlural={activeDomain === 'wine' ? 'vini' : 'spirits'}
        onExport={(mode) => void handleExportArchive(mode)}
        onClose={() => {
          setExportModalOpen(false);
          setExportError(null);
        }}
      />
    </>
  );
}
