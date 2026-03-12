import { useMemo, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';

export function SessionConfirmModal({
  open,
  enableUserLabel,
  sessionCount,
  onCancel,
  onConfirm
}: {
  open: boolean;
  enableUserLabel: boolean;
  sessionCount: number;
  onCancel: () => void;
  onConfirm: (userLabel?: string) => void;
}) {
  const [userLabel, setUserLabel] = useState('');

  const canConfirm = useMemo(() => {
    if (!enableUserLabel) return true;
    return userLabel.trim().length > 0;
  }, [enableUserLabel, userLabel]);

  return (
    <ConfirmModal
      open={open}
      title="Confermare sessione?"
      description={
        <div>
          <div>
            Confermi l’invio di <strong>{sessionCount}</strong> bottiglie?
          </div>
          {enableUserLabel ? (
            <div className="mt10">
              <input
                className="input"
                placeholder="Nome (opzionale futuro)"
                value={userLabel}
                onChange={(e) => setUserLabel(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      }
      confirmLabel={enableUserLabel ? 'Conferma' : 'Conferma'}
      cancelLabel="Annulla"
      onConfirm={() => {
        if (!canConfirm) return;
        onConfirm(enableUserLabel ? userLabel.trim() : undefined);
        setUserLabel('');
      }}
      onCancel={() => {
        setUserLabel('');
        onCancel();
      }}
    />
  );
}
