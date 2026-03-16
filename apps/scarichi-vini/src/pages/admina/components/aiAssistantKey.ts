const API_KEY_PATTERN = /sk-[A-Za-z0-9_-]{20,}/g;
const INVISIBLE_CHARS_PATTERN = /[\u200B-\u200D\uFEFF]/g;

export function normalizeApiKeyText(raw: string): string {
  const withoutInvisible = raw.replace(INVISIBLE_CHARS_PATTERN, '');
  return Array.from(withoutInvisible)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code <= 31 || code === 127) return ' ';
      if (code === 0x00a0) return ' ';
      return char;
    })
    .join('')
    .trim();
}

export function extractApiKey(raw: string): string {
  const normalized = normalizeApiKeyText(raw);
  if (!normalized) return '';

  const directMatches = normalized.match(API_KEY_PATTERN);
  if (directMatches && directMatches.length > 0) {
    return directMatches.reduce(
      (best, current) => (current.length > best.length ? current : best),
      directMatches[0]
    );
  }

  const compact = normalized.replace(/\s+/g, '');
  const compactMatches = compact.match(API_KEY_PATTERN);
  if (!compactMatches || compactMatches.length === 0) return '';
  return compactMatches.reduce(
    (best, current) => (current.length > best.length ? current : best),
    compactMatches[0]
  );
}

export function hasValidApiKey(raw: string): boolean {
  return extractApiKey(raw).length > 0;
}
