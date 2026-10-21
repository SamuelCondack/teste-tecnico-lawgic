import multer from 'multer';
import { HttpError, LiaError } from '../errors.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({
    error: { code: 'not_found', message: 'Rota não encontrada.' },
  });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  if (err instanceof LiaError) {
    return res.status(502).json({
      error: {
        code: 'ai_unavailable',
        message: err.message || 'Falha ao comunicar com a IA.',
      },
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: { code: 'invalid_upload', message: 'Arquivo inválido ou grande demais.' },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: 'internal_error', message: 'Erro interno.' },
  });
}
