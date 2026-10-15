// "Modelo" de extração do mock.
//
// Não lê o documento: confere se as evidências conhecidas chegaram no prompt. Para cada campo
// pedido (a key aparece no prompt), procura o trecho que comprova o valor. Achou, responde o
// valor com o ruído típico de um LLM; não achou, responde INDEFINIDO — que é exatamente o que
// aconteceria com um modelo real que não recebeu a parte certa do documento.
import fs from 'node:fs'
import path from 'node:path'

export function normalizeForMatch(text) {
  return String(text).normalize('NFC').replace(/\s+/g, ' ').toLowerCase()
}

export function loadEvidence(directories) {
  const knownKeys = new Set()
  const entries = []

  for (const directory of directories) {
    if (!directory || !fs.existsSync(directory)) continue
    for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort()) {
      const content = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'))
      for (const key of content.knownKeys || []) knownKeys.add(key)
      for (const entry of content.entries || []) {
        entries.push({ ...entry, normalizedMatch: normalizeForMatch(entry.match) })
      }
    }
  }
  return { knownKeys: [...knownKeys], entries }
}

function findRequestedKeys(prompt, knownKeys) {
  return knownKeys.filter(key => new RegExp(`(?<![A-Za-z0-9_])${key}(?![A-Za-z0-9_])`).test(prompt))
}

export function extract(prompt, evidence) {
  const normalizedPrompt = normalizeForMatch(prompt)
  const requestedKeys = findRequestedKeys(prompt, evidence.knownKeys)
  const present = evidence.entries.filter(entry => normalizedPrompt.includes(entry.normalizedMatch))

  const result = {}
  const missingEvidence = []

  for (const key of requestedKeys) {
    const entry = present.find(candidate => candidate.key === key && !candidate.extra)
    if (entry) {
      result[key] = entry.answer
    } else {
      result[key] = 'INDEFINIDO'
      missingEvidence.push(key)
    }
  }

  // Modelos de verdade às vezes "ajudam" com chaves que ninguém pediu.
  for (const entry of present.filter(candidate => candidate.extra)) {
    if (!(entry.key in result)) result[entry.key] = entry.answer
  }

  const text =
    'Claro! Analisei o documento e segue o resultado da extração:\n\n```json\n' +
    JSON.stringify(result, null, 2) +
    '\n```\n\nSe precisar de mais alguma informação, é só pedir.'

  return { text, requestedKeys, missingEvidence }
}
