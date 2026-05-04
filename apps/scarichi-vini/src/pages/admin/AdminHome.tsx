export type AdminRootSection =
  | 'history'
  | 'registryManager'
  | 'import'
  | 'export'
  | 'threshold'
  | 'password'
  | 'pinRequest'
  | 'reset';

export function AdminHome({
  onOpen,
  activeDomain
}: {
  onOpen: (section: AdminRootSection) => void;
  activeDomain: 'wine' | 'spirits';
}) {
  const thresholdActionDisabled = activeDomain === 'spirits';

  return (
    <div className="adminCenterSection">
      <div className="title centered mt6 adminHomeTitle">Impostazioni</div>
      <div className="adminDomainContextBadge mt8">
        Modalità attiva: {activeDomain === 'spirits' ? 'Spirits' : 'Vini'}
      </div>
      <div className="list mt12">
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('history')}>
          Sessioni storico
        </button>
        <button
          className="button adminHomeAction"
          type="button"
          onClick={() => onOpen('registryManager')}
        >
          Gestione voci filtri
        </button>
        <button
          className="button adminHomeAction"
          type="button"
          disabled={thresholdActionDisabled}
          aria-disabled={thresholdActionDisabled ? 'true' : undefined}
          onClick={() => onOpen('threshold')}
        >
          {thresholdActionDisabled ? 'Imposta Soglie (solo Vini)' : 'Imposta Soglie'}
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('password')}>
          Aggiorna password
        </button>
        <button
          className="button adminHomeAction"
          type="button"
          onClick={() => onOpen('pinRequest')}
        >
          Richiesta PIN
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('import')}>
          Importa archivio
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('export')}>
          Esporta archivio
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('reset')}>
          Reset archivio
        </button>
      </div>
    </div>
  );
}
