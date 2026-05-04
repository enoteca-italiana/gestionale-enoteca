import { useEffect, useRef, useState } from 'react';
import { hasActiveArchiveFilters, type Filters, type StockFilter } from '@/pages/admina/types';
import { useAppDomain } from '@/app/appDomain';
import { ChevronDown, RefreshCcw } from 'lucide-react';

type Props = {
  winesCount: number;
  thresholdCount: number;
  outCount: number;
  filters: Filters;
  categories: string[];
  producers: string[];
  origins: string[];
  onFiltersChange: (next: Filters) => void;
  onRequestAddCategory: (onResult: (created: string | null) => void) => void;
  onRequestAddProducer: (onResult: (created: string | null) => void) => void;
  onRequestAddOrigin: (onResult: (created: string | null) => void) => void;
  onResetFilters: () => void;
  onOpenCreate: () => void;
  onOpenTotals: () => void;
};

type StickyFilterSelectProps = {
  label: string;
  ariaLabel: string;
  value: string;
  allValue: string;
  allLabel: string;
  addLabel: string;
  options: string[];
  active: boolean;
  onAdd: () => void;
  onChange: (nextValue: string) => void;
};

function StickyFilterSelect({
  label,
  ariaLabel,
  value,
  allValue,
  allLabel,
  addLabel,
  options,
  active,
  onAdd,
  onChange
}: StickyFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectedLabel = value === allValue ? allLabel : value;

  return (
    <div className="archiveFilterField archiveFilterCustomRoot" ref={rootRef}>
      <div className="archiveFilterFieldLabel">{label}</div>
      <button
        className={`input archiveFilterControl archiveFilterSelect archiveFilterSelectButton ${
          active ? 'archiveFilterSelectActive' : ''
        }`}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="archiveFilterSelectText">{selectedLabel}</span>
        <ChevronDown className="archiveFilterSelectChevron" size={16} strokeWidth={2} />
      </button>
      {open ? (
        <div className="archiveFilterCustomMenu" role="listbox" aria-label={ariaLabel}>
          <button
            className="archiveFilterCustomAdd"
            type="button"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
          >
            {addLabel}
          </button>
          <div className="archiveFilterCustomOptions">
            <button
              className={`archiveFilterCustomOption ${
                value === allValue ? 'archiveFilterCustomOptionActive' : ''
              }`}
              type="button"
              onClick={() => {
                setOpen(false);
                onChange(allValue);
              }}
            >
              {allLabel}
            </button>
            {options.map((option) => (
              <button
                key={option}
                className={`archiveFilterCustomOption ${
                  value === option ? 'archiveFilterCustomOptionActive' : ''
                }`}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onChange(option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminArchiveToolbar({
  winesCount,
  thresholdCount,
  outCount,
  filters,
  categories,
  producers,
  origins,
  onFiltersChange,
  onRequestAddCategory,
  onRequestAddProducer,
  onRequestAddOrigin,
  onResetFilters,
  onOpenCreate,
  onOpenTotals
}: Props) {
  const { activeDomain, setActiveDomain } = useAppDomain();
  const setStockFilter = (stock: StockFilter) => onFiltersChange({ ...filters, stock });
  const hasActiveFilters = hasActiveArchiveFilters(filters);

  return (
    <section className="archiveTopBar">
      <div className="archiveTopRightSwitch">
        <div className="archiveDomainSwitch" role="group" aria-label="Seleziona modalità">
          <button
            type="button"
            className={`archiveDomainSwitchButton ${
              activeDomain === 'wine' ? 'archiveDomainSwitchButtonActive' : ''
            }`}
            onClick={() => setActiveDomain('wine')}
            aria-pressed={activeDomain === 'wine'}
          >
            Vini
          </button>
          <button
            type="button"
            className={`archiveDomainSwitchButton ${
              activeDomain === 'spirits' ? 'archiveDomainSwitchButtonActive' : ''
            }`}
            onClick={() => setActiveDomain('spirits')}
            aria-pressed={activeDomain === 'spirits'}
          >
            Spirits
          </button>
        </div>
      </div>

      <div className="archiveFilters">
        <button className="button buttonAuto archiveAddButton" type="button" onClick={onOpenCreate}>
          Aggiungi vino
        </button>

        <input
          className="input archiveFilterControl"
          placeholder="Cerca..."
          value={filters.term}
          onChange={(e) => onFiltersChange({ ...filters, term: e.target.value })}
        />

        <div className="archiveFilterGroup" role="group" aria-label="Filtri archivio">
          <StickyFilterSelect
            label="Categoria"
            ariaLabel="Filtro categoria"
            value={filters.category}
            allValue="all"
            allLabel="Tutte"
            addLabel="+ Aggiungi categoria..."
            options={categories}
            active={filters.category !== 'all'}
            onAdd={() => {
              onRequestAddCategory((created) => {
                if (!created) return;
                onFiltersChange({ ...filters, category: 'all' });
              });
            }}
            onChange={(nextValue) => onFiltersChange({ ...filters, category: nextValue })}
          />

          <StickyFilterSelect
            label="Produttore"
            ariaLabel="Filtro produttore"
            value={filters.producer}
            allValue="all"
            allLabel="Tutti"
            addLabel="+ Aggiungi produttore..."
            options={producers}
            active={filters.producer !== 'all'}
            onAdd={() => {
              onRequestAddProducer((created) => {
                if (!created) return;
                onFiltersChange({ ...filters, producer: 'all' });
              });
            }}
            onChange={(nextValue) => onFiltersChange({ ...filters, producer: nextValue })}
          />

          <StickyFilterSelect
            label="Provenienza"
            ariaLabel="Filtro provenienza"
            value={filters.origin}
            allValue="all"
            allLabel="Tutte"
            addLabel="+ Aggiungi provenienza..."
            options={origins}
            active={filters.origin !== 'all'}
            onAdd={() => {
              onRequestAddOrigin((created) => {
                if (!created) return;
                onFiltersChange({ ...filters, origin: 'all' });
              });
            }}
            onChange={(nextValue) => onFiltersChange({ ...filters, origin: nextValue })}
          />
        </div>

        <div className="archiveStatsBox" aria-label="Riepilogo vini">
          <button
            type="button"
            className={`archiveStatsItem archiveStatsItemTotal ${
              filters.stock === 'all' ? 'archiveStatsItemActive' : ''
            }`}
            onClick={() => setStockFilter('all')}
            aria-pressed={filters.stock === 'all' ? 'true' : 'false'}
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
            aria-pressed={filters.stock === 'threshold' ? 'true' : 'false'}
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
            aria-pressed={filters.stock === 'out' ? 'true' : 'false'}
          >
            <div className="archiveStatLabel">Esauriti</div>
            <div className="archiveStatValue">{outCount}</div>
          </button>
        </div>

        <button
          className={`archiveResetButton ${hasActiveFilters ? 'archiveResetButtonActive' : ''}`}
          type="button"
          aria-label="Reset filtri"
          title="Reset filtri"
          onClick={onResetFilters}
        >
          <RefreshCcw size={18} strokeWidth={2.2} />
        </button>

        <a
          className="button buttonAuto archiveAddButton archiveGoogleSheetInlineButton"
          href="https://docs.google.com/spreadsheets/d/1GjstQi4nf4oEaW1Ch36QVD7_kr3-zA-aEzBYCmUSQm8/edit?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Apri Foglio Google"
          title="Apri Foglio Google"
        >
          Foglio Google
        </a>

        <button
          className="button buttonAuto archiveAddButton archiveTotalsButton"
          type="button"
          aria-label="Totali"
          title="Totali"
          onClick={onOpenTotals}
        >
          Totali
        </button>
      </div>
    </section>
  );
}
