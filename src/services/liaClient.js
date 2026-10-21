import { config } from '../config.js';
import { LiaError } from '../errors.js';

async function request(path, body, { debug = false } = {}) {
  let response;
  try {
    response = await fetch(`${config.liaBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(debug || config.liaDebug ? { 'x-mock-debug': '1' } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new LiaError(`Não foi possível conectar à IA em ${config.liaBaseUrl}.`, {
      status: 0,
      body: { cause: error.message },
    });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `A IA respondeu ${response.status} em ${path}.`;
    throw new LiaError(message, { status: response.status, body: payload });
  }

  return payload;
}

export const liaClient = {
  chat({ system, messages, debug } = {}) {
    return request('/v1/chat', { system, messages }, { debug });
  },
  embeddings(inputs) {
    return request('/v1/embeddings', { inputs });
  },
};
