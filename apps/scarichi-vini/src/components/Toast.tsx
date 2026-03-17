import { useEffect } from 'react';

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const isStockUpdated = message.trim().toLowerCase() === 'giacenza aggiornata';

  useEffect(() => {
    const t = window.setTimeout(onClose, isStockUpdated ? 2000 : 2200);
    return () => window.clearTimeout(t);
  }, [isStockUpdated, onClose]);

  return (
    <div
      className={`toast${isStockUpdated ? ' toastSuccess' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
