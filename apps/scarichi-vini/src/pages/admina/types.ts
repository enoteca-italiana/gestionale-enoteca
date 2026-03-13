export type Mode = 'create' | 'edit';

export type StockFilter = 'all' | 'threshold' | 'out';

export type Filters = {
  term: string;
  category: string;
  producer: string;
  origin: string;
  supplier: string;
  stock: StockFilter;
};

export type WineFormState = {
  id?: string;
  category?: string;
  name: string;
  age?: string;
  producer: string;
  origin: string;
  supplier: string;
  threshold?: number;
  purchasePrice?: number;
  salePrice?: number;
  qty: number;
  notes?: string;
};

export const defaultFilters: Filters = {
  term: '',
  category: 'all',
  producer: 'all',
  origin: 'all',
  supplier: 'all',
  stock: 'all'
};

export const emptyWine: WineFormState = {
  id: undefined,
  category: '',
  name: '',
  age: '',
  producer: '',
  origin: '',
  supplier: '',
  threshold: undefined,
  purchasePrice: undefined,
  salePrice: undefined,
  qty: 0,
  notes: ''
};
