import type { AppDomain } from '@/app/appDomainContext';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import type { SortDir, SortKey } from './archiveTableUtils';

type Props = {
  domain: AppDomain;
  sortState: { key: SortKey; dir: SortDir };
  onToggleSort: (key: SortKey) => void;
  getSortAriaLabel: (key: SortKey) => string;
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (active && dir === 'za') return <ArrowDownWideNarrow size={14} strokeWidth={1.8} />;
  return <ArrowUpNarrowWide size={14} strokeWidth={1.8} />;
}

function SortableHeader({
  label,
  sortKey,
  sortState,
  onToggleSort,
  getSortAriaLabel
}: {
  label: string;
  sortKey: SortKey;
  sortState: Props['sortState'];
  onToggleSort: Props['onToggleSort'];
  getSortAriaLabel: Props['getSortAriaLabel'];
}) {
  const active = sortState.key === sortKey;
  return (
    <div className="archiveSortableHeaderCell">
      <span>{label}</span>
      <button
        className="archiveSortButton"
        type="button"
        onClick={() => onToggleSort(sortKey)}
        aria-label={getSortAriaLabel(sortKey)}
        title={active && sortState.dir === 'za' ? 'Ordine Z-A' : 'Ordine A-Z'}
      >
        <SortIcon active={active} dir={active ? sortState.dir : 'az'} />
      </button>
    </div>
  );
}

export function ArchiveTableHeader({ domain, sortState, onToggleSort, getSortAriaLabel }: Props) {
  const isWineDomain = domain === 'wine';
  return (
    <thead>
      <tr>
        <th>
          <SortableHeader
            label="CATEGORIA"
            sortKey="category"
            sortState={sortState}
            onToggleSort={onToggleSort}
            getSortAriaLabel={getSortAriaLabel}
          />
        </th>
        <th>
          <SortableHeader
            label="NOME"
            sortKey="name"
            sortState={sortState}
            onToggleSort={onToggleSort}
            getSortAriaLabel={getSortAriaLabel}
          />
        </th>
        {isWineDomain ? <th className="archiveColCenter">ANNO</th> : null}
        <th>
          <SortableHeader
            label="PRODUTTORE"
            sortKey="producer"
            sortState={sortState}
            onToggleSort={onToggleSort}
            getSortAriaLabel={getSortAriaLabel}
          />
        </th>
        {isWineDomain ? (
          <th>
            <SortableHeader
              label="PROVENIENZA"
              sortKey="origin"
              sortState={sortState}
              onToggleSort={onToggleSort}
              getSortAriaLabel={getSortAriaLabel}
            />
          </th>
        ) : null}
        <th>Acquisto</th>
        <th>Vendita</th>
        <th>Q.tà</th>
        <th>Magazzino</th>
        <th>Margine</th>
        <th>Azioni</th>
      </tr>
    </thead>
  );
}
