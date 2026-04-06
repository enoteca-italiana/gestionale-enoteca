const IT_LOCALE = 'it-IT';

function compactSpaces(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeUppercaseText(value: string) {
  return compactSpaces(value).toLocaleUpperCase(IT_LOCALE);
}

export function normalizeInitialUppercaseText(value: string) {
  const compact = compactSpaces(value);
  if (!compact) return '';

  return compact.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase(IT_LOCALE));
}

export function normalizeWineCategory(value: string) {
  return normalizeUppercaseText(value);
}

export function normalizeWineName(value: string) {
  return normalizeUppercaseText(value);
}

export function normalizeWineProducer(value: string) {
  return normalizeInitialUppercaseText(value);
}
