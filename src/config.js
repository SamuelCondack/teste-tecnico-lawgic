import dotenv from 'dotenv';

dotenv.config();

function envNumber(name, fallback) {
  return Number(process.env[name] || fallback);
}

export const config = {
  get port() {
    return envNumber('PORT', 3000);
  },
  get mongoUri() {
    return process.env.MONGO_URI || 'mongodb://localhost:27017/mini-lia';
  },
  get liaBaseUrl() {
    return (process.env.LIA_BASE_URL || 'http://localhost:4010').replace(/\/$/, '');
  },
  get liaDebug() {
    return process.env.LIA_DEBUG === '1';
  },
  get pageThreshold() {
    return envNumber('PAGE_THRESHOLD', 5);
  },
  get chunkSize() {
    return envNumber('CHUNK_SIZE', 800);
  },
  get chunkOverlap() {
    return envNumber('CHUNK_OVERLAP', 160);
  },
  get topK() {
    return envNumber('RAG_TOP_K', 2);
  },
  get maxPromptChars() {
    return envNumber('MAX_PROMPT_CHARS', 15500);
  },
  get maxUploadBytes() {
    return envNumber('MAX_UPLOAD_BYTES', 20 * 1024 * 1024);
  },
};
