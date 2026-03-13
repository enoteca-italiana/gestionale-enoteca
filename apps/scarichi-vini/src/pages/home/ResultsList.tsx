import type { Wine } from '@/domain/types';

export function ResultsList({
  wines,
  getSessionQty,
  onIncrement,
  onDecrement,
  sessionOpen,
  interactive = true
}: {
  wines: Wine[];
  getSessionQty?: (wineId: string) => number;
  onIncrement?: (wineId: string) => void;
  onDecrement?: (wineId: string) => void;
  sessionOpen: boolean;
  interactive?: boolean;
}) {
  const showActions = interactive && sessionOpen;

  if (!interactive) {
    return (
      <div className="mt12 consultiveList" role="list" aria-label="Lista vini consultiva">
        {wines.map((w, idx) => (
          <div
            key={w.id}
            className={`consultiveRow ${idx === 0 ? 'consultiveRowFirst' : ''}`}
            role="listitem"
          >
            <div className="min0">
              <div className="consultiveTopRow">
                <div className="lineTitle">{w.name}</div>
                <div className={`consultiveQty ${w.qty <= 0 ? 'consultiveQtyZero' : ''}`}>
                  {w.qty}
                </div>
              </div>
              <div className="subtle mt4">
                {w.producer} • {w.origin}
                {w.vintage ? ` • ${w.vintage}` : ''}
              </div>
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
            <div className="resultRow">
              <div className="resultInfo">
                <div className="lineTitle">{w.name}</div>
                <div className="subtle mt4">
                  {w.producer} • {w.origin}
                  {w.vintage ? ` • ${w.vintage}` : ''}
                </div>
                <div className={`inventoryBadge ${w.qty <= 0 ? 'inventoryBadgeEmpty' : ''}`}>
                  GIACENZA: {w.qty}
                </div>
              </div>

              {showActions ? (
                <div className="resultControls">
                  <button
                    className="resultControlButton resultControlButtonSecondary"
                    type="button"
                    disabled={sessionQty <= 0}
                    onClick={() => onDecrement?.(w.id)}
                  >
                    -
                  </button>
                  <div className="resultControlValue">{sessionQty}</div>
                  <button
                    className="resultControlButton"
                    type="button"
                    disabled={addDisabled}
                    onClick={() => onIncrement?.(w.id)}
                  >
                    +
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
