import { createApp } from './app.js';
import { config } from './config.js';
import { connectMongo } from './db.js';

const app = createApp();

await connectMongo(config.mongoUri);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Mini-LIA API em http://localhost:${config.port}`);
});
