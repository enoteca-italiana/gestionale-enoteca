import type { LocalSession } from '@/data/localDb';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useMemo, useState } from 'react';

function formatDateTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString('it-IT', { hour12: false });
}

export function AdminPending({
  pending,
  onBack,
  onDelete,
  onClear
}: {
  pending: LocalSession[];
  onBack: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const ordered = useMemo(() => [...pending].sort((a, b) => a.createdAt - b.createdAt), [pending]);

  return (
    <>
      <div className="card adminCard">
        <div className="row">
          <div>
            <div className="title">Sospesi</div>
            <div className="subtle mt6">Sessioni in coda (offline / non inviate).</div>
          </div>
          <button className="button buttonSecondary buttonAuto" type="button" onClick={onBack}>
            Indietro
          </button>
        </div>

        <div className="mt14">
          <button
            className="button buttonSecondary"
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={pending.length === 0}
          >
            Elimina tutte
          </button>
        </div>
      </div>

      <div className="card adminCard mt12">
        <div className="sectionTitle">Sessioni ({pending.length})</div>
        <div className="list mt12">
          {ordered.length === 0 ? (
            <div className="listItem centered">
              <div className="lineTitle">Nessuna sessione</div>
              <div className="subtle mt6">La coda si popola se confermi mentre sei offline.</div>
            </div>
          ) : (
            ordered.map((s) => (
              <div key={s.id} className="listItem">
                <div className="row">
                  <div className="min0">
                    <div className="lineTitle">{formatDateTime(s.createdAt)}</div>
                    <div className="subtle mt4">
                      {s.items.length} vini • {s.items.reduce((sum, i) => sum + i.qty, 0)} bottiglie
                      {s.userLabel ? ` • ${s.userLabel}` : ''}
                    </div>
                  </div>
                  <button
                    className="smallButton smallButtonDanger"
                    type="button"
                    onClick={() => setDeleteId(s.id)}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteId !== null}
        title="Eliminare sessione?"
        description="Eliminazione definitiva."
        confirmLabel="Elimina"
        cancelLabel="Annulla"
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmModal
        open={confirmClear}
        title="Eliminare tutte le sessioni?"
        description="Eliminazione definitiva."
        confirmLabel="Elimina tutte"
        cancelLabel="Annulla"
        onConfirm={() => {
          setConfirmClear(false);
          onClear();
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
