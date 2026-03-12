import type { Wine } from '@/domain/types';

export const mockWines: Wine[] = [
  {
    id: 'w1',
    name: 'Barolo',
    producer: 'Cantina Demo',
    origin: 'Piemonte',
    vintage: '2019',
    category: 'Italiani',
    qty: 12
  },
  {
    id: 'w2',
    name: 'Chianti Classico',
    producer: 'Fattoria Esempio',
    origin: 'Toscana',
    vintage: '2020',
    category: 'Italiani',
    qty: 6
  },
  {
    id: 'w3',
    name: 'Etna Rosso',
    producer: 'Vigneti Etnei',
    origin: 'Sicilia',
    vintage: '2021',
    category: 'Italiani',
    qty: 0
  },
  {
    id: 'w4',
    name: 'Riesling',
    producer: 'Weingut Muster',
    origin: 'Germania',
    vintage: '2022',
    category: 'Stranieri',
    qty: 9
  },
  {
    id: 'w5',
    name: 'Champagne Brut',
    producer: 'Maison Exemple',
    origin: 'Francia',
    category: 'Stranieri',
    qty: 3
  }
];
