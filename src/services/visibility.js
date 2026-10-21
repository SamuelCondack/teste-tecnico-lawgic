import { isBlank } from '../lib/text.js';

export function isFieldVisible(field, values) {
  if (!Array.isArray(field.attached) || field.attached.length === 0) return true;
  return field.attached.every(condition => {
    const current = values[condition.key];
    return Array.isArray(condition.values) && condition.values.includes(current);
  });
}

export function applyDisplayRules(fields, values) {
  const ordered = [...fields].sort((a, b) => a.order - b.order);
  const formData = {};
  const missingRequired = [];

  for (const field of ordered) {
    if (!isFieldVisible(field, values)) continue;
    const value = Object.prototype.hasOwnProperty.call(values, field.key) ? values[field.key] : null;
    formData[field.key] = value;
    if (field.required && isBlank(value)) missingRequired.push(field.key);
  }

  return { formData, missingRequired };
}
