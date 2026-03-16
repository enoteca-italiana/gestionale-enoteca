import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import type { SessionItem, Wine } from '@/domain/types';
import { formatWineInfoLine } from '@/domain/formatWineInfoLine';
import { dischargeNoteChangedEvent } from '@/data/dischargeNote';
import {
  confirmDischargeNoteDraft,
  getDischargeNoteState,
  loadDraftDischargeNote,
  saveDischargeNoteDraft
} from '@/data/dischargeNoteRepository';

function normalizeItems(itemsByWineId: Record<string, number>): SessionItem[] {
  return Object.entries(itemsByWineId)
    .map(([wineId, qty]) => ({ wineId, qty: Math.max(1, Math.min(99, Math.round(Number(qty) || 1))) }))
    .filter((item) => Boolean(item.wineId));
}

function mapItems(items: SessionItem[]): Record<string, number> {
  const next: Record<string, number> = {};
  for (const item of items) {
    if (!item.wineId || item.qty <= 0) continue;
    next[item.wineId] = Math.max(1, Math.min(99, Math.round(item.qty)));
  }
  return next;
}

function formatDateLabel(ts: number) {
  const date = new Date(ts);
  const day = new Intl.DateTimeFormat('it-IT', { day: '2-digit' }).format(date);
  const monthRaw = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(date);
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  const year = new Intl.DateTimeFormat('it-IT', { year: 'numeric' }).format(date);
  return `${day} ${month} ${year}`;
}

export function DischargeNoteDrawer({
  open,
  wines,
  onClose
}: {
  open: boolean;
  wines: Wine[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [itemsByWineId, setItemsByWineId] = useState<Record<string, number>>({});
  const [confirmReadyOpen, setConfirmReadyOpen] = useState(false);
  const [noteInProgress, setNoteInProgress] = useState(false);

  const refreshNote = useCallback(async () => {
    try {
      const [state, draft] = await Promise.all([getDischargeNoteState(), loadDraftDischargeNote()]);
      setNoteInProgress(state.hasInProgress);
      if (draft) {
        setItemsByWineId(mapItems(draft.items));
        setUpdatedAt(draft.updatedAt);
      } else {
        setItemsByWineId({});
        setUpdatedAt(Date.now());
      }
    } catch (error) {
      console.error('[DischargeNoteDrawer] refresh note failed', error);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    void refreshNote();
  }, [open, refreshNote]);

  useEffect(() => {
    if (!open) return;
    const onSync = () => {
      void refreshNote();
    };

    const poll = window.setInterval(() => {
      void refreshNote();
    }, 4000);

    window.addEventListener(dischargeNoteChangedEvent, onSync);
    window.addEventListener('focus', onSync);
    window.addEventListener('pageshow', onSync);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener(dischargeNoteChangedEvent, onSync);
      window.removeEventListener('focus', onSync);
      window.removeEventListener('pageshow', onSync);
    };
  }, [open, refreshNote]);

  const winesById = useMemo(() => {
    const map = new Map<string, Wine>();
    for (const wine of wines) map.set(wine.id, wine);
    return map;
  }, [wines]);

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];

    return wines
      .filter((wine) => {
        if (itemsByWineId[wine.id]) return false;
        const haystack = [wine.name, wine.producer, wine.supplier, wine.origin]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 8);
  }, [itemsByWineId, query, wines]);

  const noteRows = useMemo(
    () =>
      Object.entries(itemsByWineId)
        .map(([wineId, qty]) => ({ wine: winesById.get(wineId), wineId, qty }))
        .filter((row) => Boolean(row.wine))
        .sort((a, b) => (a.wine?.name ?? '').localeCompare(b.wine?.name ?? '', 'it', { sensitivity: 'base' })),
    [itemsByWineId, winesById]
  );

  const commitDraft = (nextMap: Record<string, number>) => {
    setItemsByWineId(nextMap);
    setUpdatedAt(Date.now());
    void saveDischargeNoteDraft(normalizeItems(nextMap)).catch((error) => {
      console.error('[DischargeNoteDrawer] save draft failed', error);
    });
  };

  const addWine = (wineId: string) => {
    const next = { ...itemsByWineId, [wineId]: Math.min(99, (itemsByWineId[wineId] ?? 0) + 1) };
    commitDraft(next);
    setQuery('');
  };

  const setWineQty = (wineId: string, qty: number) => {
    const safeQty = Math.max(1, Math.min(99, Math.round(qty)));
    const next = { ...itemsByWineId, [wineId]: safeQty };
    commitDraft(next);
  };

  const removeWine = (wineId: string) => {
    const next = { ...itemsByWineId };
    delete next[wineId];
    commitDraft(next);
  };

  const clearAll = () => {
    setItemsByWineId({});
    setQuery('');
    setUpdatedAt(Date.now());
    void saveDischargeNoteDraft([]).catch((error) => {
      console.error('[DischargeNoteDrawer] clear draft failed', error);
    });
  };

  const applyConfirmNote = async () => {
    if (noteInProgress) return;
    try {
      await confirmDischargeNoteDraft();
      setItemsByWineId({});
      setQuery('');
      setUpdatedAt(Date.now());
      setConfirmReadyOpen(false);
      onClose();
    } catch (error) {
      console.error('[DischargeNoteDrawer] confirm note failed', error);
      await refreshNote();
      setConfirmReadyOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="archiveNoteOverlay" role="presentation" onClick={onClose}>
      <aside
        className="archiveNoteDrawer"
        role="dialog"
        aria-modal="true"
        aria-label="Nota scarico"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="archiveNoteHeader">
          <div>
            <div className="archiveNoteTitle">Nota Scarico</div>
            <div className="archiveNoteSubtle">Data {formatDateLabel(updatedAt)}</div>
          </div>
          <button className="archiveNoteClose" type="button" aria-label="Chiudi" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="archiveNoteSearchRow">
          <input
            className="input archiveNoteSearchInput"
            placeholder="Cerca vino..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {noteInProgress ? (
          <div className="archiveNoteWarning mt10">
            Nota scarico precedente ancora da concludere in Home.
          </div>
        ) : null}

        {suggestions.length > 0 ? (
          <div className="archiveNoteSuggestions" role="list" aria-label="Suggerimenti vini">
            {suggestions.map((wine) => (
              <button
                key={wine.id}
                className="archiveNoteSuggestionRow"
                type="button"
                onClick={() => addWine(wine.id)}
                role="listitem"
              >
                <span className="lineTitle">{wine.name}</span>
                <span className="subtle">
                  {formatWineInfoLine({
                    producer: wine.producer,
                    year: wine.age ?? wine.vintage,
                    origin: wine.origin
                  })}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="archiveNoteSectionTitle mt12">Vini aggiunti</div>
        <div className="archiveNoteList archiveNoteListSimple" role="list" aria-label="Lista vini aggiunti">
          {noteRows.length === 0 ? (
            <div className="archiveNoteEmpty">Nessun vino aggiunto.</div>
          ) : (
            noteRows.map((row) =>
              row.wine ? (
                <div key={row.wineId} className="archiveNoteListRow" role="listitem">
                  <div className="min0">
                    <div className="lineTitle">{row.wine.name}</div>
                    <div className="subtle mt4">
                      {formatWineInfoLine({
                        producer: row.wine.producer,
                        year: row.wine.age ?? row.wine.vintage,
                        origin: row.wine.origin
                      })}
                    </div>
                  </div>

                  <div className="archiveNoteRowActions">
                    <select
                      className="input archiveNoteQtySelect"
                      aria-label={`Quantita da scaricare per ${row.wine.name}`}
                      value={Math.max(1, Math.min(99, row.qty))}
                      onChange={(event) => setWineQty(row.wineId, Number(event.target.value))}
                    >
                      {Array.from({ length: 99 }, (_, idx) => idx + 1).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <button
                      className="archiveNoteTrashButton"
                      type="button"
                      aria-label={`Elimina ${row.wine.name} dalla nota`}
                      onClick={() => removeWine(row.wineId)}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ) : null
            )
          )}
        </div>

        <div className="archiveNoteFooter">
          <button className="button buttonSecondary archiveNoteFooterButton" type="button" onClick={clearAll}>
            Svuota nota
          </button>
          <button
            className="button buttonSessionConfirmActive archiveNoteFooterButton"
            type="button"
            onClick={() => setConfirmReadyOpen(true)}
            disabled={noteRows.length === 0 || noteInProgress}
          >
            Conferma nota scarico
          </button>
        </div>

        <ConfirmModal
          open={confirmReadyOpen}
          title="Confermare nota scarico?"
          description="Confermando, in Home si attiva il pulsante per caricare questa nota nella sessione."
          confirmLabel="Conferma"
          cancelLabel="Annulla"
          onConfirm={() => {
            void applyConfirmNote();
          }}
          onCancel={() => setConfirmReadyOpen(false)}
        />
      </aside>
    </div>
  );
}
