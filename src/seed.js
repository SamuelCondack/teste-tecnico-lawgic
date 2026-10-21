import { config } from './config.js';
import { connectMongo, disconnectMongo } from './db.js';
import { seed } from './seedData.js';

try {
  await connectMongo(config.mongoUri);
  const result = await seed();
  console.log(`Seed ok: ${result.companies} empresas, ${result.fields} campos.`);
  await disconnectMongo();
} catch (error) {
  console.error('Seed falhou:', error);
  process.exit(1);
}
