export function normalizeOrigin(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}
