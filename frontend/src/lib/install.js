import { useEffect, useReducer } from 'react';

// The browser fires `beforeinstallprompt` early, so capture it before React renders.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

/** Install support for Android/desktop Chrome & Edge; iPhone users get instructions instead. */
export function useInstallPrompt() {
  const [, rerender] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    return () => listeners.delete(rerender);
  }, []);

  const standalone = isStandalone();
  return {
    canInstall: Boolean(deferredPrompt) && !standalone,
    showIOSHint: isIOS() && !standalone,
    async install() {
      if (!deferredPrompt) return false;
      const prompt = deferredPrompt;
      deferredPrompt = null;
      prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      notify();
      return choice?.outcome === 'accepted';
    },
  };
}
