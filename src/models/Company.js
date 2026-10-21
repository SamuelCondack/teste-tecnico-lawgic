import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    queries: { type: [String], default: [] },
  },
  { versionKey: false }
);

export const Company = mongoose.model('Company', companySchema);
