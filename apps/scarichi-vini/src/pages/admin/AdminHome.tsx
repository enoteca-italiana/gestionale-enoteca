export type AdminRootSection = 'settings' | 'sessions';

export function AdminHome({ onOpen }: { onOpen: (section: AdminRootSection) => void }) {
  return (
    <div>
      <div className="title centered">Admin</div>
      <div className="list mt12">
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('settings')}>
          Impostazioni
        </button>
        <button className="button adminHomeAction" type="button" onClick={() => onOpen('sessions')}>
          Sessioni
        </button>
      </div>
    </div>
  );
}
