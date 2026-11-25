// Optional Cloudflare Turnstile check (a free, usually invisible "are you a human" test).
// Enabled only when TURNSTILE_SECRET_KEY is set.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(secret, token, ip, fetchImpl = fetch) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  try {
    const res = await fetchImpl(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.success === true;
  } catch (error) {
    console.warn('[turnstile] verification request failed', error?.message);
    return false;
  }
}
