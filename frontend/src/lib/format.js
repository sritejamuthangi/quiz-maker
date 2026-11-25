export function formatDuration(totalSeconds) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '—');
export const formatDate = (value) => (value ? dateOnly.format(new Date(value)) : '—');

export function formatPercent(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 10) / 10}%`;
}

export function daysUntil(value) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2026-01-31T14:05" for <input type="datetime-local"> from an ISO string. */
export function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
