import { TURNSTILE_SITE_KEY } from '../config.js';

export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY);

let scriptPromise = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load the bot check. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Renders the (usually invisible) widget. onToken receives a fresh token, or null when it expires. */
export async function renderTurnstile(container, { onToken, onError }) {
  const turnstile = await loadScript();
  const widgetId = turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    appearance: 'interaction-only',
    callback: (token) => onToken(token),
    'expired-callback': () => onToken(null),
    'error-callback': () => {
      onError?.();
      return true;
    },
  });
  return {
    reset: () => turnstile.reset(widgetId),
    remove: () => turnstile.remove(widgetId),
  };
}
