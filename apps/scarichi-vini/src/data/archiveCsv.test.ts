import { describe, expect, it } from 'vitest';
import { parseArchiveCsv } from '@/data/archiveCsv';

describe('archiveCsv normalization', () => {
  it('normalizes case rules on csv import', () => {
    const raw = [
      'Categoria;Nome;Produttore;Provenienza;Quantita',
      'rossi;grenache amabile 00906;hugel;languedoc;12'
    ].join('\n');

    const rows = parseArchiveCsv(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.category).toBe('Rossi');
    expect(rows[0]?.name).toBe('GRENACHE AMABILE 00906');
    expect(rows[0]?.producer).toBe('Hugel');
    expect(rows[0]?.origin).toBe('LANGUEDOC');
  });

  it('requires only name and producer, applying defaults for missing origin and qty', () => {
    const raw = [
      'Categoria,Nome,Produttore,Anno,Provenienza,Acquisto,Vendita,Q.tà',
      ',Roen 2024,Tramin,,,"€ 17,50","€ 22,75",'
    ].join('\n');

    const rows = parseArchiveCsv(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('ROEN 2024');
    expect(rows[0]?.producer).toBe('Tramin');
    expect(rows[0]?.origin).toBe('N/D');
    expect(rows[0]?.qty).toBe(0);
    expect(rows[0]?.purchasePrice).toBe(17.5);
    expect(rows[0]?.salePrice).toBe(22.75);
  });

  it('ignores category placeholder values from spreadsheet markers', () => {
    const raw = [
      'Categoria,Nome,Produttore,Provenienza,Q.tà',
      "CATEGORIA,Nobile di montepulciano '18,Contucci,Toscana,30"
    ].join('\n');

    const rows = parseArchiveCsv(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.category).toBeUndefined();
    expect(rows[0]?.name).toBe("NOBILE DI MONTEPULCIANO '18");
    expect(rows[0]?.producer).toBe('Contucci');
    expect(rows[0]?.origin).toBe('TOSCANA');
    expect(rows[0]?.qty).toBe(30);
  });
});
