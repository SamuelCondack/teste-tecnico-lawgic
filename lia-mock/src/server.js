// LIA Mock — servidor HTTP que imita a API de IA usada no teste.
//
//   POST /v1/chat         extração de campos (ver chat.js)
//   POST /v1/embeddings   vetores para busca semântica (ver embeddings.js)
//   GET  /health
//
// Rotas de controle, usadas pela correção automática:
//   POST /__control/reset   zera os contadores
//   GET  /__control/stats   o que o mock recebeu até agora
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extract, loadEvidence } from './chat.js'
import { DIMENSIONS, embed } from './embeddings.js'

const PORT = Number(process.env.PORT || 4010)
const MAX_PROMPT_CHARS = Number(process.env.MAX_PROMPT_CHARS || 16000)
const LATENCY_MS = Number(process.env.LATENCY_MS || 150)
const DEBUG = process.env.MOCK_DEBUG === '1'

const here = path.dirname(fileURLToPath(import.meta.url))
const evidence = loadEvidence([path.join(here, '../evidence'), process.env.EXTRA_EVIDENCE_DIR])

let stats = createStats()

function createStats() {
  return {
    chat: { calls: 0, rejectedTooLarge: 0, maxPromptChars: 0, requests: [] },
    embeddings: { calls: 0, inputs: 0 },
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function sendError(res, status, code, message, extra = {}) {
  send(res, status, { error: { code, message, ...extra } })
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    req.on('error', reject)
  })
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const estimateTokens = text => Math.ceil(text.length / 4)

function handleChat(body, res, wantsDebug) {
  const messages = body.messages
  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(message => message && typeof message.content === 'string' && typeof message.role === 'string')
  if (!valid || (body.system !== undefined && typeof body.system !== 'string')) {
    return sendError(res, 400, 'invalid_request', '`messages` deve ser uma lista de { role, content } com content em texto.')
  }

  const prompt = [body.system || '', ...messages.map(message => message.content)].join('\n\n')
  stats.chat.calls++
  stats.chat.maxPromptChars = Math.max(stats.chat.maxPromptChars, prompt.length)

  if (prompt.length > MAX_PROMPT_CHARS) {
    stats.chat.rejectedTooLarge++
    return sendError(res, 413, 'context_length_exceeded', `O prompt tem ${prompt.length} caracteres; o limite é ${MAX_PROMPT_CHARS}.`, {
      maxChars: MAX_PROMPT_CHARS,
      receivedChars: prompt.length,
    })
  }

  const { text, requestedKeys, missingEvidence } = extract(prompt, evidence)
  stats.chat.requests.push({ promptChars: prompt.length, requestedKeys, missingEvidence })

  send(res, 200, {
    text,
    usage: { inputTokens: estimateTokens(prompt), outputTokens: estimateTokens(text) },
    model: 'lia-mock-1',
    ...(wantsDebug ? { debug: { requestedKeys, missingEvidence } } : {}),
  })
}

function handleEmbeddings(body, res) {
  const inputs = body.inputs
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.some(input => typeof input !== 'string')) {
    return sendError(res, 400, 'invalid_request', '`inputs` deve ser uma lista não vazia de textos.')
  }

  stats.embeddings.calls++
  stats.embeddings.inputs += inputs.length
  send(res, 200, { vectors: inputs.map(embed), dimensions: DIMENSIONS, model: 'lia-mock-embed-1' })
}

function handleControl(req, res) {
  if (req.method === 'POST' && req.url === '/__control/reset') {
    stats = createStats()
    return send(res, 200, { ok: true })
  }
  if (req.method === 'GET' && req.url === '/__control/stats') {
    const evidenceDocs = [...new Set(evidence.entries.map(entry => entry.doc))]
    return send(res, 200, { ...stats, evidenceDocs })
  }
  return sendError(res, 404, 'not_found', 'Rota de controle desconhecida.')
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true })

    let body = {}
    if (req.method === 'POST') {
      try {
        body = await readJson(req)
      } catch {
        return sendError(res, 400, 'invalid_json', 'O corpo da requisição não é um JSON válido.')
      }
    }

    if (req.url.startsWith('/__control/')) return handleControl(req, res)

    const isChat = req.method === 'POST' && req.url === '/v1/chat'
    const isEmbeddings = req.method === 'POST' && req.url === '/v1/embeddings'
    if (!isChat && !isEmbeddings) return sendError(res, 404, 'not_found', `Rota ${req.method} ${req.url} não existe.`)

    await sleep(LATENCY_MS)

    if (isChat) return handleChat(body, res, DEBUG || req.headers['x-mock-debug'] === '1')
    return handleEmbeddings(body, res)
  } catch (error) {
    console.error(error)
    sendError(res, 500, 'internal_error', 'Erro inesperado no mock.')
  }
})

server.listen(PORT, () => {
  console.log(`LIA Mock ouvindo na porta ${PORT} — ${evidence.entries.length} evidências, limite de prompt ${MAX_PROMPT_CHARS} caracteres`)
})
