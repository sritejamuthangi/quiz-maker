import { API_BASE } from '../config.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', issues, retryAfter } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
    this.retryAfter = retryAfter;
  }

  /** True when no complete response arrived; the server may still have saved it. */
  get isNetwork() {
    return this.code === 'network';
  }
}

async function request(method, path, { body, key, etag, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers.Authorization = `Bearer ${key}`;
  if (etag) headers['If-None-Match'] = etag;

  let res;
  let text;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 30_000);
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
    text = res.status === 304 ? '' : await res.text();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError("Can't reach the server. Check your internet connection and try again.", { code: 'network' });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }

  if (res.status === 304) return { notModified: true, data: null, etag };

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Something went wrong (error ${res.status}). Please try again.`, {
      status: res.status,
      code: data?.code || 'error',
      issues: data?.issues,
      retryAfter: res.headers.get('Retry-After'),
    });
  }
  if (data === null || typeof data !== 'object') {
    throw new ApiError('The server returned an unexpected response. Please try again.', { status: res.status, code: 'server_error' });
  }
  return { data, etag: res.headers.get('ETag'), notModified: false };
}

const id = (publicId) => encodeURIComponent(publicId);

export const api = {
  createTest: (body) => request('POST', '/tests', { body }),
  getTest: (publicId) => request('GET', `/tests/${id(publicId)}`),
  startTest: (publicId) => request('POST', `/tests/${id(publicId)}/start`, { body: {} }),
  submitTest: (publicId, body) => request('POST', `/tests/${id(publicId)}/submit`, { body }),

  getDashboard: (publicId, key, etag) => request('GET', `/manage/${id(publicId)}`, { key, etag }),
  updateTest: (publicId, key, body) => request('PATCH', `/manage/${id(publicId)}`, { key, body }),
  deleteTest: (publicId, key) => request('DELETE', `/manage/${id(publicId)}`, { key }),
  getResponse: (publicId, key, responseId) => request('GET', `/manage/${id(publicId)}/responses/${responseId}`, { key }),
  deleteResponse: (publicId, key, responseId) =>
    request('DELETE', `/manage/${id(publicId)}/responses/${responseId}`, { key }),
  exportResults: (publicId, key) => request('GET', `/manage/${id(publicId)}/export`, { key }),
};
