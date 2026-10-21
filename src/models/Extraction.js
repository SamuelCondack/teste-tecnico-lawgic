import mongoose from 'mongoose';

const extractionSchema = new mongoose.Schema(
  {
    companyKey: { type: String, required: true },
    strategy: { type: String, required: true, enum: ['fullContent', 'chunked'] },
    usedChunks: { type: Number, required: true, default: 0 },
    formData: { type: mongoose.Schema.Types.Mixed, required: true },
    missingRequired: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export const Extraction = mongoose.model('Extraction', extractionSchema);

export function serializeExtraction(doc) {
  return {
    id: String(doc._id),
    companyKey: doc.companyKey,
    strategy: doc.strategy,
    usedChunks: doc.usedChunks,
    formData: doc.formData,
    missingRequired: doc.missingRequired,
  };
}
