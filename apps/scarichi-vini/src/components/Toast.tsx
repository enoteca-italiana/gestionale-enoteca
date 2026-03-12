import { useEffect } from 'react';

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 2200);
    return () => window.clearTimeout(t);
  }, [onClose]);

  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
