import { describe, expect, it } from 'vitest';
import { normalizeOrigin } from '@/domain/normalizeOrigin';
import {
  normalizeWineCategory,
  normalizeWineName,
  normalizeWineProducer
} from '@/domain/normalizeWineText';

describe('normalizeWineText', () => {
  it('forces uppercase for categoria, nome e provenienza', () => {
    expect(normalizeWineCategory('  rossi  fermi ')).toBe('ROSSI FERMI');
    expect(normalizeWineName('  grenache amabile 00906 ')).toBe('GRENACHE AMABILE 00906');
    expect(normalizeOrigin('  Languedoc  france ')).toBe('LANGUEDOC FRANCE');
  });

  it('forces only first letter uppercase for produttore', () => {
    expect(normalizeWineProducer('  hUgEL  ')).toBe('Hugel');
    expect(normalizeWineProducer('  lA   rIVOLTA  ')).toBe('La Rivolta');
  });
});
