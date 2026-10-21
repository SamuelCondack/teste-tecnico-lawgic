export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export class LiaError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'LiaError';
    this.upstreamStatus = status;
    this.body = body;
  }
}
