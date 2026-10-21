export function splitIntoChunks(text, size = 800, overlap = 160) {
  const source = String(text || '');
  if (!source) return [];

  const chunkSize = Math.max(1, size);
  const step = Math.max(1, chunkSize - Math.max(0, overlap));
  const chunks = [];

  for (let start = 0, index = 0; start < source.length; start += step, index += 1) {
    chunks.push({
      index,
      start,
      text: source.slice(start, start + chunkSize),
    });
    if (start + chunkSize >= source.length) break;
  }

  return chunks;
}
