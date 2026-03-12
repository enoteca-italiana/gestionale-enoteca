export type WineId = string;

export type Wine = {
  id: WineId;
  name: string;
  producer: string;
  origin: string;
  vintage?: string;
  category?: string;
  qty: number;
};

export type SessionItem = {
  wineId: WineId;
  qty: number;
};
