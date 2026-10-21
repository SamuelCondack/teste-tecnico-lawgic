async function parse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `Falha HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export const api = {
  companies: () => fetch('/companies').then(parse),
  fields: companyKey => fetch(`/companies/${companyKey}/fields`).then(parse),
  extraction: id => fetch(`/extractions/${id}`).then(parse),
  extract(companyKey, file) {
    const form = new FormData();
    form.append('file', file);
    return fetch(`/companies/${companyKey}/extractions`, {
      method: 'POST',
      body: form,
    }).then(parse);
  },
};
