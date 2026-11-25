export const shareUrl = (publicId) => `${window.location.origin}/t/${publicId}`;

export const manageUrl = (publicId, adminKey) => `${window.location.origin}/manage/${publicId}#key=${adminKey}`;

export const managePath = (publicId, adminKey) => `/manage/${publicId}${adminKey ? `#key=${adminKey}` : ''}`;

/** Accepts a full link or just the code and returns the 10-character test code, or null. */
export function parseTestCode(input) {
  const value = String(input ?? '').trim();
  const fromUrl = /\/t\/([A-Za-z0-9]{10})(?:[/?#]|$)/.exec(value);
  const code = (fromUrl ? fromUrl[1] : value).toLowerCase();
  return /^[2-9a-hjkmnp-z]{10}$/.test(code) ? code : null;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / non-secure contexts.
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }
}

export const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export async function nativeShare({ title, text, url }) {
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch {
    return false; // cancelled or unsupported
  }
}

/** Opens the person's own mail app with the link filled in. No email service needed. */
export function mailtoLink({ subject, body }) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
