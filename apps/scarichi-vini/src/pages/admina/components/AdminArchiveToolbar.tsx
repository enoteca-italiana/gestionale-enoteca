import type { Filters, StockFilter } from '@/pages/admina/types';

type Props = {
  winesCount: number;
  thresholdCount: number;
  outCount: number;
  filters: Filters;
  categories: string[];
  onFiltersChange: (next: Filters) => void;
  onRequestAddCategory: (onResult: (created: string | null) => void) => void;
  onOpenCreate: () => void;
};

export function AdminArchiveToolbar({
  winesCount,
  thresholdCount,
  outCount,
  filters,
  categories,
  onFiltersChange,
  onRequestAddCategory,
  onOpenCreate
}: Props) {
  const setStockFilter = (stock: StockFilter) => onFiltersChange({ ...filters, stock });

  return (
    <section className="archiveTopBar">
      <div className="archiveFilters">
        <input
          className="input archiveFilterControl"
          placeholder="Cerca per nome, produttore, provenienza, note…"
          value={filters.term}
          onChange={(e) => onFiltersChange({ ...filters, term: e.target.value })}
        />

        <select
          className="input archiveFilterControl"
          value={filters.category}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '__add_category__') {
              onRequestAddCategory((created) => {
                onFiltersChange({ ...filters, category: created ?? 'all' });
              });
              return;
            }
            onFiltersChange({ ...filters, category: value });
          }}
        >
          <option value="all">Tutte le categorie</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value="__add_category__">+ Aggiungi categoria…</option>
        </select>

        <div className="archiveStatsBox" aria-label="Riepilogo vini">
          <button
            type="button"
            className={`archiveStatsItem archiveStatsItemTotal ${
              filters.stock === 'all' ? 'archiveStatsItemActive' : ''
            }`}
            onClick={() => setStockFilter('all')}
            aria-pressed={filters.stock === 'all'}
          >
            <div className="archiveStatLabel">Totale</div>
            <div className="archiveStatValue">{winesCount}</div>
          </button>
          <button
            type="button"
            className={`archiveStatsItem archiveStatsItemThreshold ${
              filters.stock === 'threshold' ? 'archiveStatsItemActive' : ''
            }`}
            onClick={() => setStockFilter('threshold')}
            aria-pressed={filters.stock === 'threshold'}
          >
            <div className="archiveStatLabel">Soglia</div>
            <div className="archiveStatValue">{thresholdCount}</div>
          </button>
          <button
            type="button"
            className={`archiveStatsItem archiveStatsItemOut ${
              filters.stock === 'out' ? 'archiveStatsItemActive' : ''
            }`}
            onClick={() => setStockFilter('out')}
            aria-pressed={filters.stock === 'out'}
          >
            <div className="archiveStatLabel">Esauriti</div>
            <div className="archiveStatValue">{outCount}</div>
          </button>
        </div>

        <button className="button buttonAuto archiveAddButton" type="button" onClick={onOpenCreate}>
          Aggiungi vino
        </button>
      </div>
    </section>
  );
}
