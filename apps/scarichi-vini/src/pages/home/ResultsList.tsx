import type { Wine } from '@/domain/types';

export function ResultsList({
  wines,
  onQuickRemove,
  getSessionQty,
  onIncrement,
  onDecrement,
  sessionOpen,
  interactive = true
}: {
  wines: Wine[];
  onQuickRemove: (wineId: string, amount: 1 | 2 | 3) => void;
  getSessionQty?: (wineId: string) => number;
  onIncrement?: (wineId: string) => void;
  onDecrement?: (wineId: string) => void;
  sessionOpen: boolean;
  interactive?: boolean;
}) {
  const showActions = interactive && sessionOpen;

  if (!interactive) {
    return (
      <div className="mt12">
        {wines.map((w, idx) => (
          <div key={w.id} className={`listItem ${idx === 0 ? '' : 'mt10'}`}>
            <div className="row">
              <div className="min0">
                <div className="lineTitle">{w.name}</div>
                <div className="subtle mt4">
                  {w.producer} • {w.origin}
                  {w.vintage ? ` • ${w.vintage}` : ''}
                </div>
              </div>
              <div className={`pill ${w.qty <= 0 ? 'pillDanger' : ''}`}>Q.tà {w.qty}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt12">
      {wines.map((w, idx) => {
        const addDisabled = w.qty <= 0 || !showActions;
        const sessionQty = getSessionQty ? getSessionQty(w.id) : 0;
        return (
          <div key={w.id} className={`listItem ${idx === 0 ? '' : 'mt10'}`}>
            <div className="row">
              <div className="min0">
                <div className="lineTitle">{w.name}</div>
                <div className="subtle mt4">
                  {w.producer} • {w.origin}
                  {w.vintage ? ` • ${w.vintage}` : ''}
                </div>
              </div>
              <div className="row rowEnd">
                <div className={`pill ${w.qty <= 0 ? 'pillDanger' : ''}`}>Q.tà {w.qty}</div>
                {showActions ? <div className="pill">Scarico {sessionQty}</div> : null}
              </div>
            </div>

            {showActions ? (
              <div className="stepper mt10">
                <button
                  className="stepperButton stepperButtonSecondary"
                  type="button"
                  disabled={sessionQty <= 0}
                  onClick={() => onDecrement?.(w.id)}
                >
                  -
                </button>
                <div className="stepperValue">{sessionQty}</div>
                <button className="stepperButton" type="button" disabled={addDisabled} onClick={() => onIncrement?.(w.id)}>
                  +
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
