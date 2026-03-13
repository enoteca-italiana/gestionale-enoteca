import type { LocalSession } from '@/data/localDb';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useState } from 'react';

function formatDateTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString('it-IT', { hour12: false });
}

export function AdminHistory({
  history,
  onBack,
  onReset
}: {
  history: LocalSession[];
  onBack: () => void;
  onReset: () => void;
}) {
  const [confirm1, setConfirm1] = useState(false);
  const [confirm2, setConfirm2] = useState(false);

  return (
    <>
      <div className="card adminCard">
        <div className="row">
          <div>
            <div className="title">Storico</div>
            <div className="subtle mt6">Solo sessioni inviate correttamente.</div>
          </div>
          <button className="button buttonSecondary buttonAuto" type="button" onClick={onBack}>
            Indietro
          </button>
        </div>

        <div className="mt14">
          <button
            className="button buttonSecondary"
            type="button"
            onClick={() => setConfirm1(true)}
            disabled={history.length === 0}
          >
            Reset storico
          </button>
        </div>
      </div>

      <div className="card adminCard mt12">
        <div className="sectionTitle">Sessioni ({history.length})</div>
        <div className="list mt12">
          {history.length === 0 ? (
            <div className="listItem centered">
              <div className="lineTitle">Nessuna sessione</div>
              <div className="subtle mt6">Lo storico si popola dopo le conferme.</div>
            </div>
          ) : (
            history.map((s) => (
              <div key={s.id} className="listItem">
                <div className="row">
                  <div className="min0">
                    <div className="lineTitle">{formatDateTime(s.submittedAt ?? s.createdAt)}</div>
                    <div className="subtle mt4">
                      {s.items.length} vini • {s.items.reduce((sum, i) => sum + i.qty, 0)} bottiglie
                      {s.userLabel ? ` • ${s.userLabel}` : ''}
                    </div>
                  </div>
                  <div className="pill">OK</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirm1}
        title="Reset storico?"
        description="Questa azione cancella definitivamente tutte le sessioni in storico."
        confirmLabel="Continua"
        cancelLabel="Annulla"
        onConfirm={() => {
          setConfirm1(false);
          setConfirm2(true);
        }}
        onCancel={() => setConfirm1(false)}
      />

      <ConfirmModal
        open={confirm2}
        title="Conferma reset definitivo"
        description="Sei sicuro? Non è possibile annullare."
        confirmLabel="Sì, cancella"
        cancelLabel="No"
        onConfirm={() => {
          setConfirm2(false);
          onReset();
        }}
        onCancel={() => setConfirm2(false)}
      />
    </>
  );
}
