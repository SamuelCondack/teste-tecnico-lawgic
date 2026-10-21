import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { Company } from '../models/Company.js';
import { Extraction, serializeExtraction } from '../models/Extraction.js';
import { Field } from '../models/Field.js';
import { extractFromDocument } from '../services/extraction.js';
import { looksLikePdf, readPdf } from '../services/pdf.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
});

export const extractionsRouter = Router();

extractionsRouter.post(
  '/companies/:companyKey/extractions',
  upload.single('file'),
  async (req, res, next) => {
    try {
      const company = await Company.findOne({ key: req.params.companyKey }).lean();
      if (!company) {
        throw new HttpError(404, 'not_found', 'Empresa não encontrada.');
      }

      if (!req.file) {
        throw new HttpError(400, 'invalid_upload', 'Envie um PDF no campo file.');
      }

      if (!looksLikePdf(req.file)) {
        throw new HttpError(400, 'invalid_upload', 'O arquivo enviado não é um PDF.');
      }

      const fields = await Field.find({ companyKey: company.key }).sort({ order: 1 }).lean();
      let pdf;
      try {
        pdf = await readPdf(req.file.buffer);
      } catch {
        throw new HttpError(400, 'invalid_upload', 'O arquivo enviado não é um PDF.');
      }
      const extraction = await extractFromDocument({ company, fields, pdf });
      res.status(201).json(extraction);
    } catch (error) {
      next(error);
    }
  }
);

extractionsRouter.get('/extractions/:id', async (req, res, next) => {
  try {
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      throw new HttpError(404, 'not_found', 'Extração não encontrada.');
    }

    const extraction = await Extraction.findById(req.params.id).lean();
    if (!extraction) {
      throw new HttpError(404, 'not_found', 'Extração não encontrada.');
    }

    res.json(serializeExtraction(extraction));
  } catch (error) {
    next(error);
  }
});
