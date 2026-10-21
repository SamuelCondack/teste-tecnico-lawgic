import { config } from '../config.js';
import { LiaError } from '../errors.js';
import { Extraction, serializeExtraction } from '../models/Extraction.js';
import { extractJsonFromAiText, cleanAiResponse } from './postprocess.js';
import { liaClient } from './liaClient.js';
import { joinChunks, selectRelevantChunks } from './rag.js';
import { applyDisplayRules } from './visibility.js';

function buildPrompt(fieldKeys, documentText) {
  return [
    'Você extrai dados de processos judiciais.',
    'Responda em JSON usando exatamente as chaves pedidas.',
    `Campos: ${fieldKeys.join(', ')}`,
    '',
    'Documento:',
    documentText,
  ].join('\n');
}

function fitPrompt(fieldKeys, documentText, maxChars) {
  const prefix = buildPrompt(fieldKeys, '');
  const budget = Math.max(0, maxChars - prefix.length);
  if (documentText.length <= budget) return buildPrompt(fieldKeys, documentText);
  return buildPrompt(fieldKeys, documentText.slice(0, budget));
}

export async function extractFromDocument({ company, fields, pdf }) {
  const fieldKeys = fields.map(field => field.key);
  const useChunked = pdf.numPages > config.pageThreshold;
  let strategy = 'fullContent';
  let usedChunks = 0;
  let documentText = pdf.text;

  if (useChunked) {
    strategy = 'chunked';
    const promptOverhead = buildPrompt(fieldKeys, '').length;
    const chunks = await selectRelevantChunks(pdf.text, company.queries, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      topK: config.topK,
      maxChars: Math.max(1000, config.maxPromptChars - promptOverhead),
    });
    usedChunks = chunks.length;
    documentText = joinChunks(chunks);
  }

  const system = 'Você extrai campos de processos judiciais e responde em JSON.';
  const prompt = fitPrompt(fieldKeys, documentText, config.maxPromptChars - system.length - 2);
  const ai = await liaClient.chat({
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  if (ai?.debug?.missingEvidence?.length) {
    console.warn(
      `[RAG] evidências ausentes para ${company.key}: ${ai.debug.missingEvidence.join(', ')}`
    );
  }

  let raw;
  try {
    raw = extractJsonFromAiText(ai?.text);
  } catch {
    throw new LiaError('A IA devolveu uma resposta que não pôde ser interpretada.');
  }
  const cleaned = cleanAiResponse(fields, raw);
  const { formData, missingRequired } = applyDisplayRules(fields, cleaned);

  const saved = await Extraction.create({
    companyKey: company.key,
    strategy,
    usedChunks,
    formData,
    missingRequired,
  });

  return serializeExtraction(saved);
}
