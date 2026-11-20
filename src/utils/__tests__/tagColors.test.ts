import { describe, expect, it } from 'vitest';
import {
  getNoteRotation,
  getTagColor,
  hashStringFNV1a,
  normalizeTag,
} from '../tagColors';

function hexToLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('tagColors', () => {
  describe('normalizeTag', () => {
    it('trims whitespace and lowercases ASCII and Polish diacritics', () => {
      expect(normalizeTag('  Studia  ')).toBe('studia');
      expect(normalizeTag('ĆWICZENIA')).toBe('ćwiczenia');
      expect(normalizeTag('   ')).toBe('');
    });
  });

  describe('hashStringFNV1a', () => {
    it('returns deterministic unsigned 32-bit integers across ASCII and Unicode', () => {
      const h1 = hashStringFNV1a('studia');
      const h2 = hashStringFNV1a('studia');
      expect(h1).toBe(h2);
      expect(Number.isInteger(h1)).toBe(true);
      expect(h1).toBeGreaterThanOrEqual(0);
      expect(h1).toBeLessThanOrEqual(0xffffffff);

      const hPl = hashStringFNV1a('ćwiczenia');
      expect(Number.isInteger(hPl)).toBe(true);
      expect(hPl).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getTagColor', () => {
    it('is deterministic and invariant to case and surrounding whitespace', () => {
      const c1 = getTagColor('studia');
      const c2 = getTagColor('Studia');
      const c3 = getTagColor('  STUDIA  ');
      expect(c1).toEqual(c2);
      expect(c2).toEqual(c3);
    });

    it('handles Polish Unicode diacritics and empty/whitespace strings safely with valid hex and contrast', () => {
      for (const tag of ['ćwiczenia', 'książki', 'żółć', 'źródło', 'półfinał', '', '   ']) {
        const color = getTagColor(tag);
        expect(color.name.length).toBeGreaterThan(0);
        expect(color.bg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(color.dark).toMatch(/^#[0-9a-f]{6}$/i);
        expect(color.light).toMatch(/^#[0-9a-f]{6}$/i);
        expect(color.text).toMatch(/^#[0-9a-f]{6}$/i);
        expect(contrastRatio(color.bg, color.text)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('procedurally generates broad distinct colors beyond a small fixed palette', () => {
      const sampleTags = [
        'studia', 'projekt', 'egzamin', 'finanse', 'dom', 'hackathon', 'zdrowie', 'ćwiczenia',
        'algorytmy', 'sieci', 'bazy', 'fizyka', 'matematyka', 'angielski', 'praca', 'zakupy',
        'sport', 'książki', 'notatki', 'laboratorium', 'wykład', 'seminarium', 'stypendium',
        'rower', 'kawa', 'muzyka', 'podróż', 'rodzina', 'hobby', 'programowanie', 'rust', 'docker',
      ];
      const mappedColors = new Set(sampleTags.map((t) => getTagColor(t).bg));
      expect(mappedColors.size).toBeGreaterThanOrEqual(24);
    });
  });

  describe('getNoteRotation', () => {
    it('always returns a finite deterministic number strictly within [-2.5, +2.5]', () => {
      const ids = [0, -1, -999, 999999, Number.NaN, 1.75, ...Array.from({ length: 200 }, (_, i) => i + 1)];
      for (const id of ids) {
        const deg = getNoteRotation(id);
        expect(Number.isFinite(deg)).toBe(true);
        expect(deg).toBeGreaterThanOrEqual(-2.5);
        expect(deg).toBeLessThanOrEqual(2.5);
        expect(getNoteRotation(id)).toBe(deg);
      }
    });

    it('produces both negative and positive tilts across task IDs 1..20', () => {
      const tilts = Array.from({ length: 20 }, (_, i) => getNoteRotation(i + 1));
      expect(tilts.some((d) => d < 0)).toBe(true);
      expect(tilts.some((d) => d > 0)).toBe(true);
    });
  });
});
