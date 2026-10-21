export function isFieldVisible(field, values) {
  if (!Array.isArray(field.attached) || field.attached.length === 0) return true;
  return field.attached.every(condition => condition.values.includes(values[condition.key]));
}

export function visibleFields(fields, values) {
  return [...fields]
    .sort((a, b) => a.order - b.order)
    .filter(field => isFieldVisible(field, values));
}
