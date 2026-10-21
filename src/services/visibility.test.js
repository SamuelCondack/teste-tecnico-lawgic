import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyDisplayRules } from './visibility.js';

test('esconde campos attached e lista obrigatórios visíveis vazios', () => {
  const fields = [
    { key: 'TIPO_ACAO', order: 1, type: 'select', required: true },
    {
      key: 'NOME_CURSO',
      order: 2,
      type: 'text',
      required: false,
      attached: [{ key: 'TIPO_ACAO', values: ['COBRANCA_INDEVIDA', 'DIPLOMA'] }],
    },
    {
      key: 'DESCRICAO_LIMINAR',
      order: 3,
      type: 'text',
      required: true,
      attached: [{ key: 'PEDIDO_LIMINAR', values: ['S'] }],
    },
    { key: 'VALOR_CAUSA', order: 4, type: 'text', required: true },
  ];

  const result = applyDisplayRules(fields, {
    TIPO_ACAO: 'DANOS_MORAIS',
    NOME_CURSO: 'Administração',
    PEDIDO_LIMINAR: 'N',
    DESCRICAO_LIMINAR: 'qualquer',
    VALOR_CAUSA: null,
  });

  assert.deepEqual(result.formData, {
    TIPO_ACAO: 'DANOS_MORAIS',
    VALOR_CAUSA: null,
  });
  assert.deepEqual(result.missingRequired, ['VALOR_CAUSA']);
});

test('attached com várias condições exige todas', () => {
  const fields = [
    {
      key: 'TIPO_LESAO',
      order: 1,
      required: false,
      attached: [
        { key: 'TIPO_OCORRENCIA', values: ['ACIDENTE'] },
        { key: 'HOUVE_VITIMA', values: ['S'] },
      ],
    },
  ];

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      applyDisplayRules(fields, { TIPO_OCORRENCIA: 'ACIDENTE', HOUVE_VITIMA: 'N' }).formData,
      'TIPO_LESAO'
    ),
    false
  );
  assert.equal(
    applyDisplayRules(fields, { TIPO_OCORRENCIA: 'ACIDENTE', HOUVE_VITIMA: 'S' }).formData.TIPO_LESAO,
    null
  );
});
