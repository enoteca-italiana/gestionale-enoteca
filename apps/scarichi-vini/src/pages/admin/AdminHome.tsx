export type AdminRootSection = 'history' | 'import' | 'threshold' | 'password' | 'reset';

export function AdminHome({ onOpen }: { onOpen: (section: AdminRootSection) => void }) {
  return (
    <div className="adminCenterSection">
      <div className="list mt12">
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('history')}>
          Sessioni storico
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('import')}>
          Importa archivio
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('threshold')}>
          Imposta Soglie
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('password')}>
          Aggiorna password
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('reset')}>
          Reset totale
        </button>
      </div>
    </div>
  );
}
