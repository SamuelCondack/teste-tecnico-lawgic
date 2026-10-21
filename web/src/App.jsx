import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { visibleFields } from './visibility.js';

const EMPTY_HINT = 'Aguardando extração';

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function FieldControl({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={event => onChange(event.target.value || null)}>
        <option value="">Selecionar…</option>
        {(field.options || []).map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'date') {
    return (
      <input
        type="text"
        inputMode="numeric"
        placeholder="AAAA-MM-DD"
        value={value || ''}
        onChange={event => onChange(event.target.value || null)}
      />
    );
  }

  return (
    <input
      type="text"
      value={value || ''}
      placeholder={EMPTY_HINT}
      onChange={event => onChange(event.target.value || null)}
    />
  );
}

export default function App() {
  const [companies, setCompanies] = useState([]);
  const [companyKey, setCompanyKey] = useState('');
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [extraction, setExtraction] = useState(null);

  useEffect(() => {
    api
      .companies()
      .then(list => {
        setCompanies(list);
        setCompanyKey(current => current || list[0]?.key || '');
      })
      .catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    if (!companyKey) return;
    let cancelled = false;
    api
      .fields(companyKey)
      .then(list => {
        if (!cancelled) setFields(list);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [companyKey]);

  const shown = useMemo(() => visibleFields(fields, values), [fields, values]);
  const missing = shown.filter(field => field.required && !values[field.key]).map(field => field.key);
  const selectedCompany = companies.find(company => company.key === companyKey);

  function setFieldValue(key, value) {
    setValues(current => ({ ...current, [key]: value || null }));
  }

  function applyExtraction(result) {
    setExtraction(result);
    setCompanyKey(result.companyKey);
    setValues(result.formData || {});
    setLookupId(result.id);
  }

  async function runExtraction() {
    if (!file) {
      setError('Escolha um PDF para extrair.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.extract(companyKey, file);
      applyExtraction(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadExtraction(event) {
    event.preventDefault();
    if (!lookupId.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.extraction(lookupId.trim());
      applyExtraction(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onFile(next) {
    if (next && next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      setError('Envie um arquivo PDF.');
      return;
    }
    setFile(next || null);
    setError('');
  }

  return (
    <div className="page">
      <div className="glow" />
      <header className="top">
        <div className="brand">
          <span className="mark">LIA</span>
          <div>
            <p className="eyebrow">Lawgic · cadastro assistido</p>
            <h1>Mini-LIA</h1>
          </div>
        </div>
        <p className="lede">
          Extraia o formulário de um processo judicial. Campos e regras mudam por empresa;
          documentos longos passam por RAG antes da IA.
        </p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Empresa e documento</h2>
          <div className="companies">
            {companies.map(company => (
              <button
                key={company.key}
                type="button"
                className={company.key === companyKey ? 'company active' : 'company'}
                onClick={() => {
                  setCompanyKey(company.key);
                  setValues({});
                  setExtraction(null);
                  setError('');
                }}
              >
                <strong>{company.name}</strong>
                <span>{company.key}</span>
              </button>
            ))}
          </div>

          <label
            className={dragOver ? 'dropzone over' : 'dropzone'}
            onDragOver={event => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={event => {
              event.preventDefault();
              setDragOver(false);
              onFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={event => onFile(event.target.files?.[0])}
            />
            <strong>{file ? file.name : 'Solte o PDF aqui'}</strong>
            <span>
              {file
                ? `${Math.ceil(file.size / 1024)} KB · clique para trocar`
                : 'processo-curto.pdf ou processo-longo.pdf'}
            </span>
          </label>

          <button className="primary" type="button" disabled={busy || !file} onClick={runExtraction}>
            {busy ? 'Aguarde…' : 'Extrair campos'}
          </button>

          <form className="lookup" onSubmit={loadExtraction}>
            <label>
              Extração já gravada
              <input
                value={lookupId}
                onChange={event => setLookupId(event.target.value)}
                placeholder="id retornado pela API"
              />
            </label>
            <button type="submit" disabled={busy || !lookupId.trim()}>
              Abrir
            </button>
          </form>

          {extraction && (
            <dl className="meta">
              <div>
                <dt>Estratégia</dt>
                <dd>{extraction.strategy === 'chunked' ? 'RAG / chunked' : 'Documento inteiro'}</dd>
              </div>
              <div>
                <dt>Trechos no prompt</dt>
                <dd>{extraction.usedChunks}</dd>
              </div>
              <div>
                <dt>Id</dt>
                <dd className="mono">{extraction.id}</dd>
              </div>
            </dl>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel form-panel">
          <div className="form-head">
            <h2>{selectedCompany?.name || 'Formulário'}</h2>
            <p>
              {shown.length} campos visíveis
              {missing.length > 0 ? ` · ${missing.length} obrigatório(s) vazios` : ''}
            </p>
          </div>

          <form className="grid" onSubmit={event => event.preventDefault()}>
            {shown.map(field => {
              const emptyRequired = field.required && !values[field.key];
              return (
                <label key={field.key} className={emptyRequired ? 'field missing' : 'field'}>
                  <span>
                    {field.label}
                    {field.required ? <em>*</em> : null}
                  </span>
                  <FieldControl
                    field={field}
                    value={field.type === 'date' ? values[field.key] : values[field.key]}
                    onChange={value => setFieldValue(field.key, value)}
                  />
                  {field.type === 'date' && values[field.key] ? (
                    <small>{formatDate(values[field.key])}</small>
                  ) : null}
                </label>
              );
            })}
          </form>

          {shown.length === 0 && <p className="empty">Nenhum campo visível para as regras atuais.</p>}
        </section>
      </main>
    </div>
  );
}
