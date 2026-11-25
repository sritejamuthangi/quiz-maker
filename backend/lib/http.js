import { formatIssues } from '../../shared/schema.js';

/** An error that is safe to show to the user. */
export class HttpError extends Error {
  constructor(status, message, code = 'error', { headers, issues } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
    this.issues = issues;
  }
}

/** Validates with a zod schema or throws a 400 that lists every problem. */
export function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = formatIssues(result.error);
  const first = issues[0];
  throw new HttpError(400, first ? first.message : 'Invalid input.', 'invalid_input', { issues });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    if (err.headers) res.set(err.headers);
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.issues ? { issues: err.issues } : {}),
    });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'This is too large to save. Try fewer or shorter questions.', code: 'too_large' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request was not valid JSON.', code: 'bad_json' });
  }

  console.error('[api] unexpected error', req.method, req.originalUrl, err);
  return res.status(500).json({ error: 'Something went wrong on our side. Please try again.', code: 'server_error' });
}
