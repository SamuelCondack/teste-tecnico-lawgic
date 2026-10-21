import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { connectMongo, disconnectMongo } from '../src/db.js';
import { Company } from '../src/models/Company.js';
import { Field } from '../src/models/Field.js';
import { seed } from '../src/seedData.js';

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

function spawnMock(port) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(rootDir, 'lia-mock'),
    env: { ...process.env, PORT: String(port), MOCK_DEBUG: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  return child;
}

async function waitFor(url, timeoutMs = 15000) {
  const start = Date.now();
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
}

async function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function json(response) {
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function postPdf(baseUrl, companyKey, fileName) {
  const filePath = path.join(rootDir, 'data', 'documents', fileName);
  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName);
  return fetch(`${baseUrl}/companies/${companyKey}/extractions`, {
    method: 'POST',
    body: form,
  });
}

const mockPort = 14010 + Math.floor(Math.random() * 400);
process.env.LIA_BASE_URL = `http://127.0.0.1:${mockPort}`;
process.env.LIA_DEBUG = '1';

const mock = spawnMock(mockPort);
let mongod;
let server;

try {
  await waitFor(`http://127.0.0.1:${mockPort}/health`);
  mongod = await MongoMemoryServer.create();
  await connectMongo(mongod.getUri('mini-lia'));

  const first = await seed();
  const second = await seed();
  assert.equal(first.companies, 2);
  assert.equal(first.fields, 25);
  assert.equal(second.companies, 2);
  assert.equal(second.fields, 25);
  assert.equal(await Company.countDocuments(), 2);
  assert.equal(await Field.countDocuments(), 25);

  const { server: httpServer, baseUrl } = await listen(createApp());
  server = httpServer;

  const missingCompany = await json(await fetch(`${baseUrl}/companies/nao-existe/fields`));
  assert.equal(missingCompany.status, 404);

  const catalog = JSON.parse(
    await fs.readFile(path.join(rootDir, 'data', 'fields.json'), 'utf8')
  );
  for (const companyKey of ['acme-edu', 'rodovia-sul']) {
    const expected = catalog
      .filter(field => field.companyKey === companyKey)
      .sort((a, b) => a.order - b.order);
    const received = await json(await fetch(`${baseUrl}/companies/${companyKey}/fields`));
    assert.equal(received.status, 200);
    assert.deepEqual(received.body, expected);
  }

  const noFile = await json(
    await fetch(`${baseUrl}/companies/acme-edu/extractions`, { method: 'POST' })
  );
  assert.equal(noFile.status, 400);

  const notPdf = new FormData();
  notPdf.append('file', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
  const badFile = await json(
    await fetch(`${baseUrl}/companies/acme-edu/extractions`, { method: 'POST', body: notPdf })
  );
  assert.equal(badFile.status, 400);

  const unknownCompany = await json(await postPdf(baseUrl, 'empresa-x', 'processo-curto.pdf'));
  assert.equal(unknownCompany.status, 404);

  const short = await json(await postPdf(baseUrl, 'acme-edu', 'processo-curto.pdf'));
  assert.equal(short.status, 201, JSON.stringify(short.body, null, 2));
  assert.equal(short.body.companyKey, 'acme-edu');
  assert.equal(short.body.strategy, 'fullContent');
  assert.equal(short.body.usedChunks, 0);
  assert.deepEqual(
    Object.keys(short.body).sort(),
    ['companyKey', 'formData', 'id', 'missingRequired', 'strategy', 'usedChunks']
  );
  assert.deepEqual(short.body.formData, ACME_FORM);
  assert.deepEqual(short.body.missingRequired, []);
  assert.equal(Object.prototype.hasOwnProperty.call(short.body.formData, 'NOME_CURSO'), false);

  const loaded = await json(await fetch(`${baseUrl}/extractions/${short.body.id}`));
  assert.equal(loaded.status, 200);
  assert.deepEqual(loaded.body.formData, ACME_FORM);

  const missingExtraction = await json(await fetch(`${baseUrl}/extractions/000000000000000000000000`));
  assert.equal(missingExtraction.status, 404);

  const invalidId = await json(await fetch(`${baseUrl}/extractions/abc`));
  assert.equal(invalidId.status, 404);

  const long = await json(await postPdf(baseUrl, 'rodovia-sul', 'processo-longo.pdf'));
  assert.equal(long.status, 201, JSON.stringify(long.body, null, 2));
  assert.equal(long.body.companyKey, 'rodovia-sul');
  assert.equal(long.body.strategy, 'chunked');
  assert.ok(long.body.usedChunks > 0, 'RAG deveria enviar ao menos um trecho');
  assert.deepEqual(long.body.formData, RODOVIA_FORM);
  assert.deepEqual(long.body.missingRequired, []);

  process.env.LIA_BASE_URL = 'http://127.0.0.1:9';
  const aiDown = await json(await postPdf(baseUrl, 'acme-edu', 'processo-curto.pdf'));
  assert.equal(aiDown.status, 502);

  console.log('E2E ok');
  console.log(`  curto: strategy=${short.body.strategy} usedChunks=${short.body.usedChunks}`);
  console.log(`  longo: strategy=${long.body.strategy} usedChunks=${long.body.usedChunks}`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await disconnectMongo().catch(() => {});
  if (mongod) await mongod.stop();
  if (mock && !mock.killed) mock.kill('SIGTERM');
  await mongoose.connection.close().catch(() => {});
}
