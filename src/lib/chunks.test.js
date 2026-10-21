import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitIntoChunks } from './chunks.js';

test('divide com overlap e cobre o texto inteiro', () => {
  const text = 'abcdefghijklmnopqrstuvwxyz';
  const chunks = splitIntoChunks(text, 10, 3);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].text, 'abcdefghij');
  assert.equal(chunks.at(-1).text.slice(-4), 'wxyz');
});

test('texto vazio vira lista vazia', () => {
  assert.deepEqual(splitIntoChunks('', 10, 2), []);
});
