import { useMemo } from 'react';
import type { Wine } from '@/domain/types';

export type SortBy = 'name' | 'producer' | 'category';

export function InventoryToolbar({
  wines,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  sortBy,
  onSortByChange
}: {
  wines: Wine[];
  query: string;
  onQueryChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  sortBy: SortBy;
  onSortByChange: (v: SortBy) => void;
}) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const w of wines) {
      if (w.category) set.add(w.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [wines]);

  return (
    <div className="card adminCard mt12">
      <div className="sectionTitle">Vini</div>
      <div className="subtle mt6">Ricerca e ordina il database.</div>

      <div className="mt10">
        <input
          className="input inputSearch"
          placeholder="Cerca vino per nome…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <div className="filtersRow mt10">
        <div className="filterBlock">
          <div className="filterLabel">Categoria</div>
          <select
            className="select"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Categoria"
            title="Categoria"
          >
            <option value="">Tutte</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="filterBlock">
          <div className="filterLabel">Ordina</div>
          <select
            className="select"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortBy)}
            aria-label="Ordina"
            title="Ordina"
          >
            <option value="name">Nome</option>
            <option value="producer">Produttore</option>
            <option value="category">Categoria</option>
          </select>
        </div>
      </div>
    </div>
  );
}
