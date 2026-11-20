export interface TagColorInfo {
  name: string;   // Polish color label
  bg: string;     // Primary pin head / chip background hex
  dark: string;   // 3D rim / shadow hex
  light: string;  // Specular highlight hex
  text: string;   // Contrasting foreground text hex for chips
}

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

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) {
    rPrime = c;
    gPrime = x;
  } else if (hue < 120) {
    rPrime = x;
    gPrime = c;
  } else if (hue < 180) {
    gPrime = c;
    bPrime = x;
  } else if (hue < 240) {
    gPrime = x;
    bPrime = c;
  } else if (hue < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return [
    Math.round((rPrime + m) * 255),
    Math.round((gPrime + m) * 255),
    Math.round((bPrime + m) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function getContrastTextHex(r: number, g: number, b: number): string {
  const bgLum = relativeLuminance(r, g, b);
  const whiteContrast = 1.05 / (bgLum + 0.05);
  const darkLum = relativeLuminance(26, 20, 16); // #1a1410
  const darkContrast = (bgLum + 0.05) / (darkLum + 0.05);
  return whiteContrast >= darkContrast ? '#ffffff' : '#1a1410';
}

function getPolishHueName(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  if (h < 15 || h >= 345) return 'Czerwony';
  if (h < 35) return 'Pomarańczowy';
  if (h < 50) return 'Bursztynowy';
  if (h < 68) return 'Żółty';
  if (h < 95) return 'Limonkowy';
  if (h < 145) return 'Zielony';
  if (h < 170) return 'Szmaragdowy';
  if (h < 192) return 'Morski';
  if (h < 215) return 'Cyjanowy';
  if (h < 245) return 'Niebieski';
  if (h < 268) return 'Indygo';
  if (h < 295) return 'Fioletowy';
  if (h < 322) return 'Śliwkowy';
  return 'Różowy';
}

/**
 * Deterministic procedural tag-to-color mapping (case & whitespace invariant).
 * Generates vibrant 3D push-pin & chip colors directly from the tag hash.
 */
export function getTagColor(tag: string): TagColorInfo {
  const normalized = normalizeTag(tag);
  const h1 = hashStringFNV1a(normalized);
  const h2 = hashStringFNV1a(`${normalized}#pin-tone`);

  const hue = h1 % 360;
  const sat = 64 + (h2 % 25);           // 64%..88%
  const light = 38 + ((h2 >>> 8) % 17); // 38%..54%

  const [r, g, b] = hslToRgb(hue, sat, light);
  const [dr, dg, db] = hslToRgb(hue, Math.min(100, sat + 6), Math.max(16, light - 15));
  const [lr, lg, lb] = hslToRgb(hue, Math.min(100, sat + 4), Math.min(82, light + 22));

  return {
    name: getPolishHueName(hue),
    bg: rgbToHex(r, g, b),
    dark: rgbToHex(dr, dg, db),
    light: rgbToHex(lr, lg, lb),
    text: getContrastTextHex(r, g, b),
  };
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
