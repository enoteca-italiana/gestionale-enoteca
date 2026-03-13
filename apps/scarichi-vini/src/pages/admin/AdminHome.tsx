export type AdminSection = 'settings' | 'history' | 'pending';

export function AdminHome({ onOpen }: { onOpen: (section: AdminSection) => void }) {
  return (
    <div className="card adminCard">
      <div className="title">Admin</div>
      <div className="subtle mt6">Impostazioni, storico e sessioni in sospeso.</div>

      <div className="list mt12">
        <button className="button buttonSecondary" type="button" onClick={() => onOpen('settings')}>
          Impostazioni
        </button>
        <button className="button buttonSecondary" type="button" onClick={() => onOpen('history')}>
          Storico sessioni
        </button>
        <button className="button buttonSecondary" type="button" onClick={() => onOpen('pending')}>
          Sessioni in sospeso
        </button>
        <a className="button" href="/admina">
          Gestione vini (nuova)
        </a>
      </div>
    </div>
  );
}
