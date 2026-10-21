import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const attachedSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    values: { type: [String], default: [] },
  },
  { _id: false }
);

const fieldSchema = new mongoose.Schema(
  {
    companyKey: { type: String, required: true },
    order: { type: Number, required: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, required: true, enum: ['text', 'date', 'select'] },
    required: { type: Boolean, default: false },
    options: { type: [optionSchema], default: undefined },
    attached: { type: [attachedSchema], default: undefined },
  },
  { versionKey: false }
);

fieldSchema.index({ companyKey: 1, key: 1 }, { unique: true });
fieldSchema.index({ companyKey: 1, order: 1 });

export const Field = mongoose.model('Field', fieldSchema);

export function serializeField(doc) {
  const field = {
    companyKey: doc.companyKey,
    order: doc.order,
    key: doc.key,
    label: doc.label,
    type: doc.type,
    required: Boolean(doc.required),
  };

  if (Array.isArray(doc.options) && doc.options.length > 0) {
    field.options = doc.options.map(option => ({
      value: option.value,
      label: option.label,
    }));
  }

  if (Array.isArray(doc.attached) && doc.attached.length > 0) {
    field.attached = doc.attached.map(rule => ({
      key: rule.key,
      values: [...rule.values],
    }));
  }

  return field;
}
