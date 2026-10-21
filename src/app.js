import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { companiesRouter } from './routes/companies.js';
import { extractionsRouter } from './routes/extractions.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDist = path.join(rootDir, 'web', 'dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(companiesRouter);
  app.use(extractionsRouter);

  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/companies') || req.path.startsWith('/extractions') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
