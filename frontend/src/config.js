// Branding lives here: change the name in one place (also update index.html and vite.config.js manifest).
export const APP_NAME = 'Quiz Maker';
export const APP_TAGLINE = 'Create a test, share a link, see scores instantly.';

/** Set only if the API is hosted on a different domain (e.g. Render). */
export const API_BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')}/api`;

/** Optional Cloudflare Turnstile bot check on "Publish". */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
