import type { Wine } from '@/domain/types';
import { normalizeOrigin } from '@/domain/normalizeOrigin';
import {
  normalizeWineCategory,
  normalizeWineName,
  normalizeWineProducer
} from '@/domain/normalizeWineText';

export type ArchiveCsvWineInput = {
  id?: string;
  category?: string;
  name: string;
  age?: string;
  producer: string;
  origin: string;
  threshold?: number;
  purchasePrice?: number;
  salePrice?: number;
  qty: number;
  notes?: string;
};

type CsvColumn = {
  header: string;
  key: keyof ArchiveCsvWineInput;
};

const CSV_COLUMNS: CsvColumn[] = [
  { header: 'ID', key: 'id' },
  { header: 'Categoria', key: 'category' },
  { header: 'Nome', key: 'name' },
  { header: 'Anno', key: 'age' },
  { header: 'Produttore', key: 'producer' },
  { header: 'Provenienza', key: 'origin' },
  { header: 'Soglia', key: 'threshold' },
  { header: 'Acquisto', key: 'purchasePrice' },
  { header: 'Vendita', key: 'salePrice' },
  { header: 'Quantita', key: 'qty' },
  { header: 'Note', key: 'notes' }
];

const HEADER_ALIASES: Record<string, keyof ArchiveCsvWineInput> = {
  id: 'id',
  categoria: 'category',
  category: 'category',
  nome: 'name',
  name: 'name',
  anno: 'age',
  age: 'age',
  produttore: 'producer',
  producer: 'producer',
  provenienza: 'origin',
  origine: 'origin',
  origin: 'origin',
  soglia: 'threshold',
  threshold: 'threshold',
  acquisto: 'purchasePrice',
  prezzoacquisto: 'purchasePrice',
  purchaseprice: 'purchasePrice',
  vendita: 'salePrice',
  prezzovendita: 'salePrice',
  saleprice: 'salePrice',
  quantita: 'qty',
  qta: 'qty',
  qty: 'qty',
  note: 'notes',
  notes: 'notes'
};

const CATEGORY_PLACEHOLDERS = new Set(['categoria', 'category']);

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(';') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatNumber(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return String(value);
}

function parseRows(raw: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      cell = '';
      const allEmpty = row.every((item) => item.trim() === '');
      if (!allEmpty) rows.push(row);
      row = [];
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    const allEmpty = row.every((item) => item.trim() === '');
    if (!allEmpty) rows.push(row);
  }

  return rows;
}

function detectDelimiter(raw: string): string {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ';' : ',';
}

function parseLooseNumber(raw: string): number | undefined {
  const compact = raw.trim().replace(/[€\s]/g, '');
  if (!compact) return undefined;

  let normalized = compact;
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replaceAll('.', '').replace(',', '.');
    } else {
      normalized = normalized.replaceAll(',', '');
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toCsvRecord(wine: Wine): ArchiveCsvWineInput {
  return {
    id: wine.id,
    category: wine.category ? normalizeWineCategory(wine.category) : '',
    name: normalizeWineName(wine.name),
    age: wine.age ?? '',
    producer: normalizeWineProducer(wine.producer),
    origin: normalizeOrigin(wine.origin),
    threshold: wine.threshold,
    purchasePrice: wine.purchasePrice,
    salePrice: wine.salePrice,
    qty: wine.qty,
    notes: wine.notes ?? ''
  };
}

export function buildArchiveCsv(wines: Wine[]): string {
  const headerLine = CSV_COLUMNS.map((column) => escapeCsvValue(column.header)).join(';');
  const bodyLines = wines.map((wine) => {
    const row = toCsvRecord(wine);
    return CSV_COLUMNS.map((column) => {
      const value = row[column.key];
      if (typeof value === 'number') return escapeCsvValue(formatNumber(value));
      return escapeCsvValue((value ?? '').toString());
    }).join(';');
  });

  return [headerLine, ...bodyLines].join('\n');
}

export function parseArchiveCsv(raw: string): ArchiveCsvWineInput[] {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  if (!trimmed) throw new Error('File CSV vuoto');

  const delimiter = detectDelimiter(trimmed);
  const rows = parseRows(trimmed, delimiter);
  if (rows.length < 2) throw new Error('CSV non valido: mancano righe dati');

  const headers = rows[0];
  const map = new Map<number, keyof ArchiveCsvWineInput>();
  headers.forEach((header, index) => {
    const alias = HEADER_ALIASES[normalizeHeader(header)];
    if (alias) map.set(index, alias);
  });

  const required: (keyof ArchiveCsvWineInput)[] = ['name', 'producer'];
  const missing = required.filter((field) => !Array.from(map.values()).includes(field));
  if (missing.length > 0) {
    throw new Error(`CSV non valido: colonne obbligatorie mancanti (${missing.join(', ')})`);
  }

  const parsed: ArchiveCsvWineInput[] = [];

  for (let r = 1; r < rows.length; r += 1) {
    const line = rows[r];
    const record: Partial<ArchiveCsvWineInput> = {};
    map.forEach((field, index) => {
      const rawCell = (line[index] ?? '').trim();
      if (!rawCell) return;
      if (field === 'category' && CATEGORY_PLACEHOLDERS.has(normalizeHeader(rawCell))) {
        return;
      }
      if (
        field === 'threshold' ||
        field === 'purchasePrice' ||
        field === 'salePrice' ||
        field === 'qty'
      ) {
        const parsedNumber = parseLooseNumber(rawCell);
        if (parsedNumber !== undefined) {
          record[field] = field === 'qty' ? Math.max(0, Math.round(parsedNumber)) : parsedNumber;
        }
        return;
      }
      record[field] = rawCell;
    });

    const rowNumber = r + 1;
    const name = normalizeWineName((record.name ?? '').toString());
    const producer = normalizeWineProducer((record.producer ?? '').toString());
    const origin = normalizeOrigin((record.origin ?? 'N/D').toString());
    const qty = typeof record.qty === 'number' ? record.qty : 0;

    if (!name || !producer) {
      throw new Error(`Riga ${rowNumber} non valida: richiesti Nome e Produttore`);
    }

    parsed.push({
      id: record.id?.toString(),
      category: record.category?.toString()
        ? normalizeWineCategory(record.category.toString())
        : undefined,
      name,
      age: record.age?.toString(),
      producer,
      origin,
      threshold: typeof record.threshold === 'number' ? record.threshold : undefined,
      purchasePrice: typeof record.purchasePrice === 'number' ? record.purchasePrice : undefined,
      salePrice: typeof record.salePrice === 'number' ? record.salePrice : undefined,
      qty,
      notes: record.notes?.toString()
    });
  }

  return parsed;
}
