// Everything a person creates or answers is remembered on their own device (no accounts).

const PREFIX = 'qm:';
// If browser storage is disabled/full, keep this page session usable. This
// fallback intentionally cannot survive closing or reloading the page.
const memoryOnly = new Map();

function read(key, fallback) {
  if (memoryOnly.has(key)) return memoryOnly.get(key);
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    memoryOnly.delete(key);
    return true;
  } catch {
    memoryOnly.set(key, value);
    return false; // storage full or disabled (private mode): the app still works, just without memory
  }
}

function remove(key) {
  memoryOnly.delete(key);
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Tests created on this device, with their private keys. */
export const myTests = {
  list: () => {
    const stored = read('mytests', []);
    return Array.isArray(stored) ? stored.filter((t) => t && typeof t.publicId === 'string' && typeof t.adminKey === 'string') : [];
  },
  get: (publicId) => myTests.list().find((t) => t.publicId === publicId) ?? null,
  save(entry) {
    const all = myTests.list();
    const existing = all.find((t) => t.publicId === entry.publicId);
    const merged = { ...existing, ...entry };
    return write('mytests', [merged, ...all.filter((t) => t.publicId !== entry.publicId)].slice(0, 300));
  },
  remove: (publicId) => write('mytests', myTests.list().filter((t) => t.publicId !== publicId)),
  isPersistent: () => !memoryOnly.has('mytests'),
};

/** Unpublished drafts ("new") and unsaved edits ("edit:<id>"). */
export const drafts = {
  get: (key = 'new') => read(`draft:${key}`, null),
  set: (key, draft) => write(`draft:${key}`, draft),
  clear: (key = 'new') => remove(`draft:${key}`),
};

/** A test that is being taken right now (survives reloads and the phone going to sleep). */
export const attempts = {
  get(publicId) {
    const value = read(`attempt:${publicId}`, null);
    return value && typeof value.token === 'string' && Array.isArray(value.questions) && value.questions.length && value.answers && value.settings
      ? value : null;
  },
  set: (publicId, attempt) => write(`attempt:${publicId}`, attempt),
  clear: (publicId) => remove(`attempt:${publicId}`),
};

/** The last result for a test on this device. */
export const results = {
  get: (publicId) => read(`result:${publicId}`, null),
  set: (publicId, result) => write(`result:${publicId}`, result),
  clear: (publicId) => remove(`result:${publicId}`),
};

/** The taker's name and extra field, pre-filled next time. */
export const taker = {
  get: () => read('taker', { name: '', extra: '' }),
  set: (value) => write('taker', value),
};
