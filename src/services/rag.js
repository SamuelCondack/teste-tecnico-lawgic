import { splitIntoChunks } from '../lib/chunks.js';
import { cosineSimilarity } from '../lib/cosine.js';
import { liaClient } from './liaClient.js';

async function embedAll(texts) {
  if (texts.length === 0) return [];
  const BATCH = 64;
  const vectors = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const response = await liaClient.embeddings(slice);
    if (!Array.isArray(response?.vectors) || response.vectors.length !== slice.length) {
      throw new Error('A IA devolveu embeddings em formato inesperado.');
    }
    vectors.push(...response.vectors);
  }

  return vectors;
}

export async function selectRelevantChunks(text, queries, options) {
  const {
    chunkSize,
    chunkOverlap,
    topK,
    maxChars,
  } = options;

  const phrases = (queries || []).map(query => String(query).trim()).filter(Boolean);
  const chunks = splitIntoChunks(text, chunkSize, chunkOverlap);
  if (chunks.length === 0) return [];
  if (phrases.length === 0) return chunks.slice(0, Math.max(1, topK));

  const vectors = await embedAll([...chunks.map(chunk => chunk.text), ...phrases]);
  const chunkVectors = vectors.slice(0, chunks.length);
  const queryVectors = vectors.slice(chunks.length);

  const selected = new Map();

  for (const queryVector of queryVectors) {
    const ranked = chunks
      .map((chunk, index) => ({
        chunk,
        score: cosineSimilarity(queryVector, chunkVectors[index]),
      }))
      .sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index);

    for (const item of ranked.slice(0, Math.max(1, topK))) {
      const previous = selected.get(item.chunk.index);
      if (!previous || item.score > previous.score) selected.set(item.chunk.index, item);
    }
  }

  let chosen = [...selected.values()].sort((a, b) => a.chunk.index - b.chunk.index);

  const joinedLength = list => list.reduce((sum, item, index) => (
    sum + item.chunk.text.length + (index > 0 ? 5 : 0)
  ), 0);

  while (chosen.length > 1 && joinedLength(chosen) > maxChars) {
    let worst = 0;
    for (let i = 1; i < chosen.length; i += 1) {
      if (chosen[i].score < chosen[worst].score) worst = i;
    }
    chosen.splice(worst, 1);
  }

  return chosen.map(item => item.chunk);
}

export function joinChunks(chunks) {
  return chunks.map(chunk => chunk.text).join('\n---\n');
}
