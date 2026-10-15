// Embedder determinístico: bag-of-words com hashing.
//
// Não entende sinônimos como um modelo de verdade, só palavras em comum. Para o teste isso
// basta: o que se avalia é o pipeline (chunking, similaridade, topK, deduplicação), e com um
// embedder previsível dá para saber de antemão quais trechos uma busca correta encontra.

export const DIMENSIONS = 512

// Palavras frequentes demais para ajudar a distinguir trechos.
const STOPWORDS = new Set(
  'a o e as os de da do das dos em no na nos nas um uma uns umas por para com sem que se ao aos sua seu suas seus pela pelo pelas pelos ou como mais nao foi ser sao este esta isso esse essa ate apos sob nos pois qual quais'.split(
    ' '
  )
)

// Corte simples de sufixo: "acidente" e "acidentes" caem no mesmo balde.
const STEM_LENGTH = 6

function tokenize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(token => token.length >= 2 && !STOPWORDS.has(token))
    .map(token => token.slice(0, STEM_LENGTH)) ?? []
}

// FNV-1a de 32 bits.
function hash(token) {
  let value = 0x811c9dc5
  for (let i = 0; i < token.length; i++) {
    value ^= token.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

export function embed(text) {
  const vector = new Array(DIMENSIONS).fill(0)
  for (const token of tokenize(text)) vector[hash(token) % DIMENSIONS] += 1

  // Raiz da frequência: uma palavra repetida dez vezes não deve dominar o trecho.
  for (let i = 0; i < DIMENSIONS; i++) vector[i] = Math.sqrt(vector[i])

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return norm === 0 ? vector : vector.map(value => Number((value / norm).toFixed(6)))
}
