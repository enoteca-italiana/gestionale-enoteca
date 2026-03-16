import { normalizeOrigin } from '@/domain/normalizeOrigin';
import { normalizeWineProducer } from '@/domain/normalizeWineText';

export function formatWineInfoLine(input: {
  producer?: string | null;
  year?: string | number | null;
  origin?: string | null;
}) {
  const producer =
    typeof input.producer === 'string' && input.producer.trim().length > 0
      ? normalizeWineProducer(input.producer)
      : '';
  const origin =
    typeof input.origin === 'string' && input.origin.trim().length > 0
      ? normalizeOrigin(input.origin)
      : '';
  const rawYear = input.year;
  const year =
    typeof rawYear === 'number'
      ? String(rawYear)
      : typeof rawYear === 'string'
        ? rawYear.trim()
        : '';

  return [producer, year, origin].filter((v) => v.length > 0).join(' • ');
}
