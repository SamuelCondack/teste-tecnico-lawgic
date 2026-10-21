import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

function waitFor(url, timeoutMs = 20000) {
  const start = Date.now();
  return (async () => {
    while (Date.now() - start < timeoutMs) {
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch {
        // ainda subindo
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error(`Timeout esperando ${url}`);
  })();
}

async function postPdf(baseUrl, companyKey, fileName) {
  const buffer = await fs.readFile(path.join(rootDir, 'data', 'documents', fileName));
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName);
  return fetch(`${baseUrl}/companies/${companyKey}/extractions`, { method: 'POST', body: form });
}

const mockPort = 14010;
const apiPort = 13000;
const mongod = await MongoMemoryServer.create();
const mongoUri = mongod.getUri('mini-lia');

const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: String(apiPort),
  MONGO_URI: mongoUri,
  LIA_BASE_URL: `http://127.0.0.1:${mockPort}`,
};

const mock = spawn(process.execPath, ['src/server.js'], {
  cwd: path.join(rootDir, 'lia-mock'),
  env: { ...env, PORT: String(mockPort) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let api;
try {
  await waitFor(`http://127.0.0.1:${mockPort}/health`);

  const seed = spawnSync(process.execPath, ['src/seed.js'], {
    cwd: rootDir,
    env,
    encoding: 'utf8',
  });
  assert.equal(seed.status, 0, seed.stderr || seed.stdout);
  assert.match(seed.stdout, /Seed ok: 2 empresas, 25 campos/);
  console.log(seed.stdout.trim());

  api = spawn(process.execPath, ['src/index.js'], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stderr.on('data', chunk => process.stderr.write(chunk));

  const baseUrl = `http://127.0.0.1:${apiPort}`;
  await waitFor(`${baseUrl}/health`);

  const home = await fetch(baseUrl);
  const html = await home.text();
  assert.equal(home.status, 200);
  assert.match(html, /Mini-LIA/);

  const fields = await fetch(`${baseUrl}/companies/acme-edu/fields`);
  assert.equal(fields.status, 200);
  assert.equal((await fields.json()).length, 13);

  const missing = await fetch(`${baseUrl}/companies/nao-existe/fields`);
  assert.equal(missing.status, 404);

  const short = await postPdf(baseUrl, 'acme-edu', 'processo-curto.pdf');
  const shortBody = await short.json();
  assert.equal(short.status, 201, JSON.stringify(shortBody));
  assert.equal(shortBody.strategy, 'fullContent');
  assert.deepEqual(shortBody.formData, ACME_FORM);

  const long = await postPdf(baseUrl, 'rodovia-sul', 'processo-longo.pdf');
  const longBody = await long.json();
  assert.equal(long.status, 201, JSON.stringify(longBody));
  assert.equal(longBody.strategy, 'chunked');
  assert.ok(longBody.usedChunks > 0);
  assert.deepEqual(longBody.formData, RODOVIA_FORM);

  const loaded = await fetch(`${baseUrl}/extractions/${shortBody.id}`);
  assert.equal(loaded.status, 200);

  console.log('Entrega simulada ok (mesmo fluxo do Docker: seed.js && index.js)');
  console.log(`  curto: ${shortBody.strategy} / ${shortBody.usedChunks} chunks`);
  console.log(`  longo: ${longBody.strategy} / ${longBody.usedChunks} chunks`);
} finally {
  if (api && !api.killed) api.kill('SIGTERM');
  if (mock && !mock.killed) mock.kill('SIGTERM');
  await mongod.stop();
}
