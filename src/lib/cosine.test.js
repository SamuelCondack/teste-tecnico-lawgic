import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cosineSimilarity } from './cosine.js';

test('cosseno de vetores paralelos é 1', () => {
  assert.equal(cosineSimilarity([1, 2, 3], [2, 4, 6]), 1);
});

test('cosseno de vetor nulo é 0', () => {
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
});

test('cosseno de vetores ortogonais é 0', () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});
