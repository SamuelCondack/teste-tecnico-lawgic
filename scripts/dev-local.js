import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { connectMongo } from '../src/db.js';
import { seed } from '../src/seedData.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.LIA_BASE_URL = process.env.LIA_BASE_URL || 'http://127.0.0.1:4010';

const mock = spawn(process.execPath, ['src/server.js'], {
  cwd: path.join(rootDir, 'lia-mock'),
  env: { ...process.env, PORT: '4010' },
  stdio: 'inherit',
});

const mongod = await MongoMemoryServer.create();
await connectMongo(mongod.getUri('mini-lia'));
const seeded = await seed();
const app = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Mini-LIA em http://localhost:${config.port}`);
  console.log(`Seed: ${seeded.companies} empresas, ${seeded.fields} campos (Mongo em memória)`);
});

async function shutdown() {
  server.close();
  await mongod.stop();
  if (!mock.killed) mock.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
