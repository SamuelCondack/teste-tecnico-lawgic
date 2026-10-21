import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export function looksLikePdf(file) {
  if (!file?.buffer?.length) return false;
  const magic = file.buffer.subarray(0, 5).toString('utf8') === '%PDF-';
  const mime = String(file.mimetype || '').toLowerCase();
  const name = String(file.originalname || '').toLowerCase();
  return magic || mime === 'application/pdf' || name.endsWith('.pdf');
}

export async function readPdf(buffer) {
  const result = await pdfParse(buffer);
  return {
    text: String(result.text || '').trim(),
    numPages: Number(result.numpages || 0),
  };
}
