export type WineId = string;

export type Wine = {
  id: WineId;
  category?: string;
  name: string;
  age?: string;
  producer: string;
  origin: string;
  threshold?: number;
  purchasePrice?: number;
  salePrice?: number;
  vintage?: string;
  qty: number;
  warehouse?: number;
  margin?: number;
  notes?: string;
};

export type SessionItem = {
  wineId: WineId;
  qty: number;
};
