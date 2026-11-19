export interface TagColorInfo {
  name: string;   // Polish color label
  bg: string;     // Primary pin head / chip background hex
  dark: string;   // 3D rim / shadow hex
  light: string;  // Specular highlight hex
  text: string;   // Contrasting foreground text hex for chips
}

export const TAG_COLOR_PALETTE: readonly TagColorInfo[] = [
  { name: 'Czerwony',     bg: '#dc2626', dark: '#991b1b', light: '#f87171', text: '#ffffff' },
  { name: 'Granatowy',    bg: '#2563eb', dark: '#1d4ed8', light: '#60a5fa', text: '#ffffff' },
  { name: 'Szmaragdowy',  bg: '#059669', dark: '#047857', light: '#34d399', text: '#ffffff' },
  { name: 'Fioletowy',    bg: '#7c3aed', dark: '#5b21b6', light: '#a78bfa', text: '#ffffff' },
  { name: 'Pomarańczowy', bg: '#ea580c', dark: '#9a3412', light: '#fb923c', text: '#ffffff' },
  { name: 'Morski',       bg: '#0d9488', dark: '#115e59', light: '#2dd4bf', text: '#ffffff' },
  { name: 'Amarantowy',   bg: '#db2777', dark: '#9d174d', light: '#f472b6', text: '#ffffff' },
  { name: 'Indygo',       bg: '#4f46e5', dark: '#3730a3', light: '#818cf8', text: '#ffffff' },
  { name: 'Limonkowy',    bg: '#65a30d', dark: '#3f6212', light: '#a3e635', text: '#ffffff' },
  { name: 'Bursztynowy',  bg: '#d97706', dark: '#92400e', light: '#fbbf24', text: '#ffffff' },
  { name: 'Cyjanowy',     bg: '#0284c7', dark: '#075985', light: '#38bdf8', text: '#ffffff' },
  { name: 'Śliwkowy',     bg: '#a21caf', dark: '#701a75', light: '#e879f9', text: '#ffffff' },
] as const;

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * 32-bit unsigned FNV-1a hash returning an integer in [0, 4_294_967_295].
 */
export function hashStringFNV1a(input: string): number {
  let hash = 0x811c9dc5; // 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // 16777619
  }
  return hash >>> 0;
}

/**
 * Deterministic tag-to-color mapping (case & whitespace invariant).
 */
export function getTagColor(tag: string): TagColorInfo {
  const normalized = normalizeTag(tag);
  const idx = hashStringFNV1a(normalized) % TAG_COLOR_PALETTE.length;
  return TAG_COLOR_PALETTE[idx];
}

/**
 * Deterministic subtle Post-it rotation strictly within [-2.5, +2.5] degrees.
 */
export function getNoteRotation(taskId: number): number {
  const safeId = Number.isFinite(taskId) ? Math.trunc(taskId) : 0;
  const hash = hashStringFNV1a(`note-tilt-${safeId}`);
  const deg = Math.round(((hash % 501) / 100 - 2.5) * 100) / 100;
  return deg === 0 ? 0 : deg;
}
