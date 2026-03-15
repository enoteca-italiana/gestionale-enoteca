export function formatWineInfoLine(input: {
  producer?: string | null;
  year?: string | number | null;
  origin?: string | null;
}) {
  const producer = typeof input.producer === 'string' ? input.producer.trim() : '';
  const origin = typeof input.origin === 'string' ? input.origin.trim() : '';
  const rawYear = input.year;
  const year =
    typeof rawYear === 'number'
      ? String(rawYear)
      : typeof rawYear === 'string'
        ? rawYear.trim()
        : '';

  return [producer, year, origin].filter((v) => v.length > 0).join(' • ');
}
