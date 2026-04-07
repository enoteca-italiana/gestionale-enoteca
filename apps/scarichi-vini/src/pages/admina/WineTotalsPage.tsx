import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { APP_ROUTES } from '@/app/routes';
import type { Wine } from '@/domain/types';
import { listCategoryOptions } from '@/data/categoryRepository';
import { loadDb } from '@/data/localDb';
import { listOriginOptions } from '@/data/originRepository';
import { listProducerOptions } from '@/data/producerRepository';
import { listWines } from '@/data/wineRepository';

type TotalsFilters = {
  category: string;
  producer: string;
  origin: string;
};

const DEFAULT_FILTERS: TotalsFilters = {
  category: 'all',
  producer: 'all',
  origin: 'all'
};

const MONEY_FORMATTER = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

function formatMoney(value: number) {
  return MONEY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function safeNumber(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function WineTotalsPage() {
  const [, setLocation] = useLocation();
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TotalsFilters>(DEFAULT_FILTERS);

  const loadData = useCallback(async () => {
    setError(null);
    const local = loadDb().inventory;
    const hasLocalData = local.length > 0;
    if (hasLocalData) {
      setWines(local);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      setWines(await listWines({ forceRemote: true }));
    } catch (err) {
      console.error('[WineTotalsPage] load error', err);
      if (!hasLocalData) {
        setError('Impossibile caricare i totali. Verifica connessione/Supabase.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasMatchingCategory = useCallback(
    (wine: Wine) => {
      if (filters.producer !== 'all') {
        if ((wine.producer ?? '').toLowerCase() !== filters.producer.toLowerCase()) return false;
      }
      if (filters.origin !== 'all') {
        if ((wine.origin ?? '').toLowerCase() !== filters.origin.toLowerCase()) return false;
      }
      return true;
    },
    [filters.origin, filters.producer]
  );

  const hasMatchingProducer = useCallback(
    (wine: Wine) => {
      if (filters.category !== 'all') {
        if ((wine.category ?? '').toLowerCase() !== filters.category.toLowerCase()) return false;
      }
      if (filters.origin !== 'all') {
        if ((wine.origin ?? '').toLowerCase() !== filters.origin.toLowerCase()) return false;
      }
      return true;
    },
    [filters.category, filters.origin]
  );

  const hasMatchingOrigin = useCallback(
    (wine: Wine) => {
      if (filters.category !== 'all') {
        if ((wine.category ?? '').toLowerCase() !== filters.category.toLowerCase()) return false;
      }
      if (filters.producer !== 'all') {
        if ((wine.producer ?? '').toLowerCase() !== filters.producer.toLowerCase()) return false;
      }
      return true;
    },
    [filters.category, filters.producer]
  );

  const categories = useMemo(() => {
    const scoped = listCategoryOptions(wines.filter(hasMatchingCategory), []);
    const selected = filters.category;
    if (selected !== 'all' && !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())) {
      return listCategoryOptions([], [...scoped, selected]);
    }
    return scoped;
  }, [filters.category, hasMatchingCategory, wines]);

  const producers = useMemo(() => {
    const scoped = listProducerOptions(wines.filter(hasMatchingProducer), []);
    const selected = filters.producer;
    if (selected !== 'all' && !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())) {
      return listProducerOptions([], [...scoped, selected]);
    }
    return scoped;
  }, [filters.producer, hasMatchingProducer, wines]);

  const origins = useMemo(() => {
    const scoped = listOriginOptions(wines.filter(hasMatchingOrigin), []);
    const selected = filters.origin;
    if (selected !== 'all' && !scoped.some((value) => value.toLowerCase() === selected.toLowerCase())) {
      return listOriginOptions([], [...scoped, selected]);
    }
    return scoped;
  }, [filters.origin, hasMatchingOrigin, wines]);

  const filteredWines = useMemo(() => {
    return wines.filter((wine) => {
      if (filters.category !== 'all') {
        if ((wine.category ?? '').toLowerCase() !== filters.category.toLowerCase()) return false;
      }
      if (filters.producer !== 'all') {
        if ((wine.producer ?? '').toLowerCase() !== filters.producer.toLowerCase()) return false;
      }
      if (filters.origin !== 'all') {
        if ((wine.origin ?? '').toLowerCase() !== filters.origin.toLowerCase()) return false;
      }
      return true;
    });
  }, [filters.category, filters.origin, filters.producer, wines]);

  const totals = useMemo(() => {
    let totalPurchase = 0;
    let totalSale = 0;
    let totalMargin = 0;
    let totalWarehouse = 0;

    for (const wine of filteredWines) {
      const purchase = safeNumber(wine.purchasePrice);
      const sale = safeNumber(wine.salePrice);
      const qty = Math.max(0, Number(wine.qty) || 0);
      totalPurchase += purchase;
      totalSale += sale;
      totalMargin += sale - purchase;
      totalWarehouse += purchase * qty;
    }

    return {
      totalPurchase: Number(totalPurchase.toFixed(2)),
      totalSale: Number(totalSale.toFixed(2)),
      totalMargin: Number(totalMargin.toFixed(2)),
      totalWarehouse: Number(totalWarehouse.toFixed(2)),
      winesCount: filteredWines.length
    };
  }, [filteredWines]);

  return (
    <div className="container archiveDesktopContainer">
      <div className="archiveLogoTop">
        <img
          className="archiveLogoImg"
          src="/logo.png"
          alt="Enoteca Italiana"
          loading="lazy"
          decoding="async"
          width={2252}
          height={237}
        />
      </div>

      <div className="archiveTotalsContent">
        <section className="archiveTotalsTopBar">
          <div className="archiveTotalsTitleWrap">
            <h2 className="archiveTotalsTitle">Totali Archivio</h2>
            <p className="archiveTotalsSubtitle">
              Vista rapida dei totali complessivi in tempo reale filtrati per categoria, produttore e provenienza.
            </p>
            <div className="archiveTotalsMeta archiveTotalsMetaTop">
              {loading ? 'Aggiornamento totali…' : `${totals.winesCount} voci incluse nel calcolo`}
            </div>
          </div>
        </section>

        <section className="archiveTotalsFilters" aria-label="Filtri totali archivio">
          <label className="archiveTotalsFilterField">
            Categoria
            <select
              className="input archiveFilterControl"
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="all">Tutte</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="archiveTotalsFilterField">
            Produttore
            <select
              className="input archiveFilterControl"
              value={filters.producer}
              onChange={(e) => setFilters((prev) => ({ ...prev, producer: e.target.value }))}
            >
              <option value="all">Tutti</option>
              {producers.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="archiveTotalsFilterField">
            Provenienza
            <select
              className="input archiveFilterControl"
              value={filters.origin}
              onChange={(e) => setFilters((prev) => ({ ...prev, origin: e.target.value }))}
            >
              <option value="all">Tutte</option>
              {origins.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error ? (
          <div className="card adminCard mt12 adminError">
            <div className="lineTitle">{error}</div>
          </div>
        ) : null}

        <section className="archiveTotalsGrid" aria-live="polite">
          <article className="archiveTotalsCard">
            <div className="archiveTotalsCardLabel">Totale acquisto</div>
            <div className="archiveTotalsCardValue">{formatMoney(totals.totalPurchase)}</div>
            <div className="archiveTotalsCardCalc">Somma di tutti i prezzi di acquisto delle voci filtrate.</div>
          </article>
          <article className="archiveTotalsCard">
            <div className="archiveTotalsCardLabel">Totale vendita</div>
            <div className="archiveTotalsCardValue">{formatMoney(totals.totalSale)}</div>
            <div className="archiveTotalsCardCalc">Somma di tutti i prezzi di vendita delle voci filtrate.</div>
          </article>
          <article className="archiveTotalsCard">
            <div className="archiveTotalsCardLabel">Totale margine</div>
            <div className="archiveTotalsCardValue">{formatMoney(totals.totalMargin)}</div>
            <div className="archiveTotalsCardCalc">Somma di (Prezzo vendita - Prezzo acquisto) per ogni voce filtrata.</div>
          </article>
          <article className="archiveTotalsCard archiveTotalsCardWarehouse">
            <div className="archiveTotalsCardLabel">Totale magazzino</div>
            <div className="archiveTotalsCardValue">{formatMoney(totals.totalWarehouse)}</div>
            <div className="archiveTotalsCardCalc">Somma di (Prezzo acquisto × Q.tà bottiglie) per ogni voce filtrata.</div>
          </article>
        </section>

      </div>

      <div className="archiveTotalsBottomActions">
        <button
          className="button archiveTotalsExitButton"
          type="button"
          onClick={() => setLocation(APP_ROUTES.ARCHIVE)}
        >
          Esci
        </button>
      </div>
    </div>
  );
}
