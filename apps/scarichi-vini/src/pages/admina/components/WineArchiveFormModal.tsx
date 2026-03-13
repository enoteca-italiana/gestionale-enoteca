import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Mode, WineFormState } from '@/pages/admina/types';

type Props = {
  open: boolean;
  mode: Mode;
  busy: boolean;
  initial: WineFormState;
  categories: string[];
  origins: string[];
  onRequestAddCategory: (onResult: (created: string | null) => void) => void;
  onRequestAddOrigin: (onResult: (created: string | null) => void) => void;
  onSubmit: (wine: WineFormState) => Promise<void>;
  onCancel: () => void;
};

function asNumber(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeYear(value?: string) {
  const normalized = value?.trim() ?? '';
  if (!normalized) return '';
  if (normalized.toUpperCase() === 'NV') return '';
  return /^\d{4}$/.test(normalized) ? normalized : '';
}

export function WineArchiveFormModal({
  open,
  mode,
  busy,
  initial,
  categories,
  origins,
  onRequestAddCategory,
  onRequestAddOrigin,
  onSubmit,
  onCancel
}: Props) {
  const [state, setState] = useState<WineFormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let year = currentYear; year >= 1900; year -= 1) {
      years.push(String(year));
    }
    return years;
  }, []);
  const thresholdOptions = useMemo(() => {
    const values: number[] = [];
    for (let value = 1; value <= 99; value += 1) values.push(value);
    return values;
  }, []);
  const qtyOptions = useMemo(() => {
    const values: number[] = [];
    for (let value = 0; value <= 99; value += 1) values.push(value);
    return values;
  }, []);

  useEffect(() => {
    if (open) {
      setState({
        ...initial,
        age: normalizeYear(initial.age),
        qty: Number.isFinite(initial.qty) ? Math.max(0, Math.min(99, Math.round(initial.qty))) : 0
      });
      setError(null);
    }
  }, [open, initial]);

  const canSubmit = useMemo(() => {
    return (
      state.name.trim().length > 0 &&
      state.producer.trim().length > 0 &&
      state.origin.trim().length > 0
    );
  }, [state.name, state.origin, state.producer]);

  if (!open) return null;

  const setField = (key: keyof WineFormState, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const setNumericField = (key: keyof WineFormState, value: string) => {
    setState((prev) => ({ ...prev, [key]: asNumber(value) }));
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    try {
      await onSubmit({
        ...state,
        age: normalizeYear(state.age),
        qty: Number.isFinite(state.qty) ? Math.max(0, Math.round(state.qty)) : 0
      });
    } catch (err) {
      console.error('[WineArchiveFormModal] submit error', err);
      setError('Salvataggio non riuscito. Riprova.');
    }
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard archiveModalCard">
        <div className="modalTitle">{mode === 'create' ? 'Aggiungi vino' : 'Modifica vino'}</div>

        <div className="archiveFormGrid mt12">
          <label className="modalLabel">
            Categoria
            <select
              className="input mt4"
              value={state.category ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__add_category__') {
                  onRequestAddCategory((created) => {
                    if (created) setField('category', created);
                  });
                  return;
                }
                setField('category', value);
              }}
            >
              <option value="">Seleziona categoria</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              <option value="__add_category__">+ Aggiungi categoria…</option>
            </select>
          </label>
          <label className="modalLabel archiveFormSpan2">
            Nome
            <input
              className="input mt4"
              value={state.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </label>
          <label className="modalLabel">
            Anno
            <select
              className="input mt4"
              value={state.age ?? ''}
              onChange={(e) => setField('age', e.target.value)}
            >
              <option value="">Vuoto</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="modalLabel">
            Produttore
            <input
              className="input mt4"
              value={state.producer}
              onChange={(e) => setField('producer', e.target.value)}
            />
          </label>
          <div className="archiveFormInlineOriginThreshold">
            <label className="modalLabel">
              Provenienza
              <select
                className="input mt4"
                value={state.origin}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '__add_origin__') {
                    onRequestAddOrigin((created) => {
                      if (created) setField('origin', created);
                    });
                    return;
                  }
                  setField('origin', value);
                }}
              >
                <option value="">Seleziona provenienza</option>
                {origins.map((origin) => (
                  <option key={origin} value={origin}>
                    {origin}
                  </option>
                ))}
                <option value="__add_origin__">+ Aggiungi provenienza…</option>
              </select>
            </label>
            <label className="modalLabel archiveFormThresholdLabel">
              <span className="archiveThresholdTitle">
                Soglia
                <AlertTriangle className="archiveThresholdWarning" size={14} strokeWidth={1.8} />
              </span>
              <select
                className="input mt4"
                value={state.threshold === undefined ? '' : String(state.threshold)}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setState((prev) => ({ ...prev, threshold: undefined }));
                    return;
                  }
                  const parsed = Number(value);
                  if (!Number.isFinite(parsed)) return;
                  setState((prev) => ({ ...prev, threshold: Math.max(1, Math.round(parsed)) }));
                }}
              >
                <option value="">Vuoto</option>
                {thresholdOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="archiveFormInline3">
            <label className="modalLabel archiveFormQtyLabel">
              Q.tà
              <select
                className="input mt4"
                value={String(state.qty)}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (!Number.isFinite(parsed)) return;
                  const nextQty = Math.max(0, Math.min(99, Math.round(parsed)));
                  setState((prev) => ({ ...prev, qty: nextQty }));
                }}
              >
                {qtyOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="modalLabel">
              Acquisto
              <div className="archiveCurrencyInputWrap mt4">
                <span className="archiveCurrencyPrefix" aria-hidden="true">
                  €
                </span>
                <input
                  className="input archiveCurrencyInput"
                  inputMode="decimal"
                  value={state.purchasePrice ?? ''}
                  onChange={(e) => setNumericField('purchasePrice', e.target.value)}
                />
              </div>
            </label>
            <label className="modalLabel">
              Vendita
              <div className="archiveCurrencyInputWrap mt4">
                <span className="archiveCurrencyPrefix" aria-hidden="true">
                  €
                </span>
                <input
                  className="input archiveCurrencyInput"
                  inputMode="decimal"
                  value={state.salePrice ?? ''}
                  onChange={(e) => setNumericField('salePrice', e.target.value)}
                />
              </div>
            </label>
          </div>
          <label className="modalLabel archiveFormSpan2">
            Note
            <textarea
              className="input mt4 archiveNotesInput"
              value={state.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              rows={2}
            />
          </label>
        </div>

        {error ? <div className="errorText mt8">{error}</div> : null}

        <div className="modalActions archiveModalActions">
          <button
            className="button buttonSecondary buttonCancel archiveModalActionButton"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Annulla
          </button>
          <button
            className="button archiveModalActionButton"
            type="button"
            onClick={submit}
            disabled={!canSubmit || busy}
          >
            {busy ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
