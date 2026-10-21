import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Company } from './models/Company.js';
import { Field } from './models/Field.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');

async function readJson(fileName) {
  const fullPath = path.join(dataDir, fileName);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

export async function seed() {
  const [companies, fields, queries] = await Promise.all([
    readJson('companies.json'),
    readJson('fields.json'),
    readJson('queries.json'),
  ]);

  for (const company of companies) {
    await Company.findOneAndUpdate(
      { key: company.key },
      {
        $set: {
          key: company.key,
          name: company.name,
          queries: Array.isArray(queries[company.key]) ? queries[company.key] : [],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (const field of fields) {
    const $set = {
      companyKey: field.companyKey,
      order: field.order,
      key: field.key,
      label: field.label,
      type: field.type,
      required: Boolean(field.required),
    };
    const $unset = {};

    if (Array.isArray(field.options)) $set.options = field.options;
    else $unset.options = 1;

    if (Array.isArray(field.attached)) $set.attached = field.attached;
    else $unset.attached = 1;

    const update = { $set };
    if (Object.keys($unset).length > 0) update.$unset = $unset;

    await Field.findOneAndUpdate(
      { companyKey: field.companyKey, key: field.key },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const [companyCount, fieldCount] = await Promise.all([
    Company.countDocuments(),
    Field.countDocuments(),
  ]);

  return { companies: companyCount, fields: fieldCount };
}
