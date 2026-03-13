export type AdminRootSection = 'settings' | 'sessions';

export function AdminHome({ onOpen }: { onOpen: (section: AdminRootSection) => void }) {
  return (
    <div className="card adminCard">
      <div className="title">Admin</div>
      <div className="subtle mt6">Seleziona area di gestione.</div>

      <div className="list mt12">
        <button className="button buttonSecondary" type="button" onClick={() => onOpen('settings')}>
          Impostazioni
        </button>
        <button className="button buttonSecondary" type="button" onClick={() => onOpen('sessions')}>
          Sessioni
        </button>
        <a className="button" href="/admina">
          Gestione vini (nuova)
        </a>
      </div>
    </div>
  );
}
