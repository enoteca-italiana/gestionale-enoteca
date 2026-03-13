import { useMemo, useState } from 'react';
import { getBool, setBool, storageKeys } from '@/pages/admin/storage';
import { ConfirmModal } from '@/components/ConfirmModal';
import { parseArchiveCsv, type ArchiveCsvWineInput } from '@/data/archiveCsv';
import { replaceAllWines } from '@/data/wineRepository';

function SettingToggle({
  label,
  description,
  value,
  onChange
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="listItem">
      <div className="row">
        <div className="min0">
          <div className="lineTitle">{label}</div>
          <div className="subtle mt4">{description}</div>
        </div>
        <button
          className={`toggle ${value ? 'toggleOn' : ''}`}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => onChange(!value)}
        >
          <span className="toggleKnob" />
        </button>
      </div>
    </div>
  );
}

export function AdminSettings({
  onChangePassword,
  onLogout,
  onHardReset,
  onBack
}: {
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  onLogout: () => void;
  onHardReset: () => void;
  onBack?: () => void;
}) {
  const [requireFinalConfirm, setRequireFinalConfirm] = useState(() =>
    getBool(storageKeys.settingRequireFinalConfirm, true)
  );
  const [enableUserLabel, setEnableUserLabel] = useState(() =>
    getBool(storageKeys.settingEnableUserLabel, false)
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState(false);
  const [reset1, setReset1] = useState(false);
  const [reset2, setReset2] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ArchiveCsvWineInput[] | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importOk, setImportOk] = useState<string | null>(null);
  const [importConfirm, setImportConfirm] = useState(false);

  const canChange = useMemo(
    () => currentPassword.length > 0 && newPassword.length >= 4,
    [currentPassword, newPassword]
  );

  const saveRequireFinalConfirm = (v: boolean) => {
    setRequireFinalConfirm(v);
    setBool(storageKeys.settingRequireFinalConfirm, v);
  };

  const saveEnableUserLabel = (v: boolean) => {
    setEnableUserLabel(v);
    setBool(storageKeys.settingEnableUserLabel, v);
  };

  const changePassword = async () => {
    setPwdError(null);
    setPwdOk(false);
    setBusy(true);
    try {
      const ok = await onChangePassword(currentPassword, newPassword);
      if (!ok) {
        setPwdError('Password attuale non corretta');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setPwdOk(true);
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

  return (
    <>
      <div className="card adminCard">
        <div className="row">
          <div>
            <div className="title">Impostazioni</div>
            <div className="subtle mt6">
              Configurazioni operative (locali, finché non colleghiamo Supabase).
            </div>
          </div>
          <div className="row">
            {onBack ? (
              <button className="button buttonSecondary buttonAuto" type="button" onClick={onBack}>
                Indietro
              </button>
            ) : null}
            <button className="button buttonSecondary buttonAuto" type="button" onClick={onLogout}>
              Esci
            </button>
          </div>
        </div>

        <div className="list mt12">
          <SettingToggle
            label="Conferma finale"
            description="Richiede la modale di conferma prima di inviare la sessione."
            value={requireFinalConfirm}
            onChange={saveRequireFinalConfirm}
          />
          <SettingToggle
            label="Nome utente per scarico"
            description="Predisposizione: associa lo scarico a un nome (non obbligatorio in baseline)."
            value={enableUserLabel}
            onChange={saveEnableUserLabel}
          />
        </div>
      </div>

      <div className="card adminCard mt12">
        <div className="sectionTitle">Password admin</div>
        <div className="subtle mt6">Minimo 4 caratteri.</div>

        <div className="mt10">
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
        {pwdOk ? <div className="okText mt10">Password aggiornata</div> : null}

        <div className="mt14">
          <button
            className="button"
            type="button"
            disabled={!canChange || busy}
            onClick={changePassword}
          >
            Aggiorna password
          </button>
        </div>
      </div>

      <div className="card adminCard mt12">
        <div className="sectionTitle">Importa archivio CSV</div>
        <div className="subtle mt6">
          L&apos;import sostituisce totalmente l&apos;archivio vini attuale con i record del file CSV.
        </div>
        <div className="subtle mt6">
          Formato consigliato: export da Archivio ({' '}
          <span className="mono">ID;Categoria;Nome;Anno;Produttore;Provenienza;Fornitore;Soglia;Acquisto;Vendita;Quantita;Note</span>{' '}
          ).
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

        <div className="mt14">
          <button
            className="button buttonSecondary"
            type="button"
            disabled={!importFile || importBusy}
            onClick={() => void prepareImport()}
          >
            Importa archivio
          </button>
        </div>
      </div>

      <div className="card adminCard mt12">
        <div className="sectionTitle">Reset totale</div>
        <div className="subtle mt6">
          Cancella inventario locale, storico e sospesi. Azione definitiva.
        </div>
        <div className="mt14">
          <button className="button buttonSecondary" type="button" onClick={() => setReset1(true)}>
            Reset totale
          </button>
        </div>
      </div>

      <ConfirmModal
        open={reset1}
        title="Reset totale?"
        description="Cancella inventario locale, storico e sospesi."
        confirmLabel="Continua"
        cancelLabel="Annulla"
        onConfirm={() => {
          setReset1(false);
          setReset2(true);
        }}
        onCancel={() => setReset1(false)}
      />

      <ConfirmModal
        open={reset2}
        title="Conferma reset definitivo"
        description="Sei sicuro? Non è possibile annullare."
        confirmLabel="Sì, reset"
        cancelLabel="No"
        onConfirm={() => {
          setReset2(false);
          onHardReset();
        }}
        onCancel={() => setReset2(false)}
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
          void importArchive();
        }}
        onCancel={() => {
          if (importBusy) return;
          setImportConfirm(false);
        }}
      />
    </>
  );
}
