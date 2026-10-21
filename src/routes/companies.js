import { Router } from 'express';
import { HttpError } from '../errors.js';
import { Company } from '../models/Company.js';
import { Field, serializeField } from '../models/Field.js';

export const companiesRouter = Router();

companiesRouter.get('/companies', async (_req, res, next) => {
  try {
    const companies = await Company.find().sort({ name: 1 }).lean();
    res.json(companies.map(company => ({ key: company.key, name: company.name })));
  } catch (error) {
    next(error);
  }
});

companiesRouter.get('/companies/:companyKey/fields', async (req, res, next) => {
  try {
    const company = await Company.findOne({ key: req.params.companyKey }).lean();
    if (!company) {
      throw new HttpError(404, 'not_found', 'Empresa não encontrada.');
    }

    const fields = await Field.find({ companyKey: company.key }).sort({ order: 1 }).lean();
    res.json(fields.map(serializeField));
  } catch (error) {
    next(error);
  }
});
