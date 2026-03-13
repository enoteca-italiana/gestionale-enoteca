import type { SessionItem, Wine } from '@/domain/types';

export function SummaryList({
  sessionCount,
  items,
  wines,
  onIncrement,
  onDecrement,
  onDelete
}: {
  sessionCount: number;
  items: SessionItem[];
  wines: Wine[];
  onIncrement: (wineId: string) => void;
  onDecrement: (wineId: string) => void;
  onDelete: (wineId: string) => void;
}) {
  return (
    <div className="card mt12">
      <div className="row">
        <div className="sectionTitle">Riepilogo</div>
        <div className="pill">Totale {sessionCount}</div>
      </div>
      <div className="subtle mt6">Correggi con +1 / -1 / elimina.</div>

      <div className="list mt12">
        {items.length === 0 ? (
          <div className="listItem centered">
            <div className="lineTitle">Nessun vino</div>
            <div className="subtle mt6">Aggiungi scarichi dai risultati.</div>
          </div>
        ) : (
          items.map((i) => {
            const wine = wines.find((w) => w.id === i.wineId);
            if (!wine) return null;
            return (
              <div key={i.wineId} className="listItem">
                <div className="row">
                  <div className="min0">
                    <div className="lineTitle">{wine.name}</div>
                    <div className="subtle mt4">
                      {wine.producer} • {wine.origin}
                      {wine.vintage ? ` • ${wine.vintage}` : ''}
                    </div>
                  </div>
                  <div className="pill">-{i.qty}</div>
                </div>
                <div className="quickButtons mt10">
                  <button
                    className="smallButton"
                    type="button"
                    onClick={() => onIncrement(i.wineId)}
                    disabled={wine.qty <= 0}
                  >
                    +1
                  </button>
                  <button
                    className="smallButton smallButtonSecondary"
                    type="button"
                    onClick={() => onDecrement(i.wineId)}
                  >
                    -1
                  </button>
                  <button
                    className="smallButton smallButtonDanger"
                    type="button"
                    onClick={() => onDelete(i.wineId)}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
