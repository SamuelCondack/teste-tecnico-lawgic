import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.API_URL || 'http://127.0.0.1:3000';

const ACME_FORM = {
  NUMERO_PROCESSO: '1012345-67.2025.8.26.0114',
  DATA_DISTRIBUICAO: '2025-03-12',
  NOME_AUTOR: 'Mariana Costa Ribeiro',
  CPF_AUTOR: '123.456.789-09',
  TIPO_ACAO: 'DANOS_MORAIS',
  NEGATIVACAO: 'S',
  ORGAO_NEGATIVACAO: 'SERASA',
  PEDIDO_LIMINAR: 'S',
  DESCRICAO_LIMINAR: 'Exclusão imediata do nome da autora dos cadastros de inadimplentes',
  VALOR_DANO_MORAL: 'R$ 15.000,00',
  VALOR_CAUSA: 'R$ 19.870,00',
};

const RODOVIA_FORM = {
  NUMERO_PROCESSO: '5004321-10.2025.8.21.0001',
  NOME_AUTOR: 'Carlos Eduardo Nunes',
  TIPO_OCORRENCIA: 'ACIDENTE',
  DATA_FATO: '2025-01-22',
  NOME_RODOVIA: 'BR-116',
  KM_RODOVIA: 'km 245',
  PLACA_VEICULO: 'ABC1D23',
  HOUVE_VITIMA: 'S',
  TIPO_LESAO: 'GRAVE',
  NUMERO_BO: '2025/000987',
  DATA_BO: '2025-01-23',
  VALOR_CAUSA: 'R$ 250.000,00',
};

async function waitFor(url, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Timeout esperando ${url}`);
}

async function postPdf(companyKey, fileName) {
  const buffer = await fs.readFile(path.join(rootDir, 'data', 'documents', fileName));
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName);
  return fetch(`${baseUrl}/companies/${companyKey}/extractions`, { method: 'POST', body: form });
}

await waitFor(`${baseUrl}/health`);

const home = await fetch(baseUrl);
assert.equal(home.status, 200);
assert.match(await home.text(), /Mini-LIA/);

const catalog = JSON.parse(await fs.readFile(path.join(rootDir, 'data', 'fields.json'), 'utf8'));
for (const companyKey of ['acme-edu', 'rodovia-sul']) {
  const expected = catalog.filter(field => field.companyKey === companyKey).sort((a, b) => a.order - b.order);
  const response = await fetch(`${baseUrl}/companies/${companyKey}/fields`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
}

const missingCompany = await fetch(`${baseUrl}/companies/nao-existe/fields`);
assert.equal(missingCompany.status, 404);

const shortResponse = await postPdf('acme-edu', 'processo-curto.pdf');
const short = await shortResponse.json();
assert.equal(shortResponse.status, 201, JSON.stringify(short));
assert.equal(short.strategy, 'fullContent');
assert.equal(short.usedChunks, 0);
assert.deepEqual(short.formData, ACME_FORM);
assert.deepEqual(short.missingRequired, []);

const loaded = await fetch(`${baseUrl}/extractions/${short.id}`);
assert.equal(loaded.status, 200);

const longResponse = await postPdf('rodovia-sul', 'processo-longo.pdf');
const long = await longResponse.json();
assert.equal(longResponse.status, 201, JSON.stringify(long));
assert.equal(long.strategy, 'chunked');
assert.ok(long.usedChunks > 0);
assert.deepEqual(long.formData, RODOVIA_FORM);
assert.deepEqual(long.missingRequired, []);

console.log('Contrato HTTP ok');
console.log(`  curto: ${short.strategy} / ${short.usedChunks} chunks`);
console.log(`  longo: ${long.strategy} / ${long.usedChunks} chunks`);
