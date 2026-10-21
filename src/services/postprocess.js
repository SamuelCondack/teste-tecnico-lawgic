import { isEmptyAiValue, isValidUtcDate, normalizeComparable, toIsoDate } from '../lib/text.js';

export function extractJsonFromAiText(text) {
  const raw = String(text || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];

  if (fenced) candidates.push(fenced[1]);

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // tenta o próximo recorte
    }
  }

  throw new Error('A resposta da IA não contém um JSON válido.');
}

export function parseDateValue(value) {
  const source = String(value).trim();
  const br = source.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3]);
    return isValidUtcDate(year, month, day) ? toIsoDate(year, month, day) : null;
  }

  const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return isValidUtcDate(year, month, day) ? toIsoDate(year, month, day) : null;
  }

  return null;
}

export function matchSelectValue(value, options = []) {
  const needle = normalizeComparable(value);
  for (const option of options) {
    if (normalizeComparable(option.value) === needle) return option.value;
    if (normalizeComparable(option.label) === needle) return option.value;
  }
  return null;
}

export function cleanFieldValue(field, raw) {
  if (raw == null || isEmptyAiValue(raw)) return null;

  const asText = String(raw).trim();
  if (!asText) return null;

  if (field.type === 'date') return parseDateValue(asText);
  if (field.type === 'select') return matchSelectValue(asText, field.options || []);
  return asText;
}

export function cleanAiResponse(fields, rawPayload) {
  const source = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const values = {};

  for (const field of fields) {
    values[field.key] = Object.prototype.hasOwnProperty.call(source, field.key)
      ? cleanFieldValue(field, source[field.key])
      : null;
  }

  return values;
}
