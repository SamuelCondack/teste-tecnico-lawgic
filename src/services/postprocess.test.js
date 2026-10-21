import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cleanAiResponse,
  extractJsonFromAiText,
  matchSelectValue,
  parseDateValue,
} from './postprocess.js';

test('extrai JSON de um bloco markdown', () => {
  const text = 'Claro!\n\n```json\n{"NOME_AUTOR":"Ana"}\n```\n';
  assert.deepEqual(extractJsonFromAiText(text), { NOME_AUTOR: 'Ana' });
});

test('datas BR viram ISO e inválidas viram null', () => {
  assert.equal(parseDateValue('12/03/2025'), '2025-03-12');
  assert.equal(parseDateValue('2025-03-12'), '2025-03-12');
  assert.equal(parseDateValue('32/13/2025'), null);
});

test('select casa value, label, caixa e acento', () => {
  const options = [{ value: 'N', label: 'Não' }];
  assert.equal(matchSelectValue('NÃO', options), 'N');
  assert.equal(matchSelectValue('nao', options), 'N');
  assert.equal(matchSelectValue('N', options), 'N');
  assert.equal(matchSelectValue('talvez', options), null);
});

test('limpa resposta da IA segundo o tipo do campo', () => {
  const fields = [
    { key: 'NOME_AUTOR', type: 'text' },
    { key: 'DATA_FATO', type: 'date' },
    { key: 'NEGATIVACAO', type: 'select', options: [{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }] },
    { key: 'EXTRA', type: 'text' },
  ];
  const cleaned = cleanAiResponse(fields, {
    NOME_AUTOR: '  Mariana Costa Ribeiro ',
    DATA_FATO: '22/01/2025',
    NEGATIVACAO: 'SIM',
    OBSERVACOES: 'não deveria entrar',
    EXTRA: 'INDEFINIDO',
  });
  assert.deepEqual(cleaned, {
    NOME_AUTOR: 'Mariana Costa Ribeiro',
    DATA_FATO: '2025-01-22',
    NEGATIVACAO: 'S',
    EXTRA: null,
  });
});
