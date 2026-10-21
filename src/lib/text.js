export function stripDiacritics(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeComparable(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function isBlank(value) {
  return value == null || String(value).trim() === '';
}

const EMPTY_TOKENS = new Set([
  'indefinido',
  'nao se aplica',
  'não se aplica',
  'n/a',
  'n.a',
  'n.a.',
  'na',
]);

export function isEmptyAiValue(value) {
  if (isBlank(value)) return true;
  return EMPTY_TOKENS.has(normalizeComparable(value));
}

export function isValidUtcDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function toIsoDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
