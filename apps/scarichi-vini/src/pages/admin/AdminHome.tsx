export type AdminRootSection =
  | 'history'
  | 'registryManager'
  | 'import'
  | 'export'
  | 'threshold'
  | 'password'
  | 'pinRequest'
  | 'reset';

export function AdminHome({ onOpen }: { onOpen: (section: AdminRootSection) => void }) {
  return (
    <div className="adminCenterSection">
      <div className="title centered mt6 adminHomeTitle">Impostazioni</div>
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
          onClick={() => onOpen('threshold')}
        >
          Imposta Soglie
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
