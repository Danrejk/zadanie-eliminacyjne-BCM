import { describe, expect, it } from 'vitest';
import {
  getNoteRotation,
  getTagColor,
  hashStringFNV1a,
  normalizeTag,
  TAG_COLOR_PALETTE,
} from '../tagColors';

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

    it('handles Polish Unicode diacritics and empty/whitespace strings safely', () => {
      for (const tag of ['ćwiczenia', 'książki', 'żółć', 'źródło', 'półfinał', '', '   ']) {
        const color = getTagColor(tag);
        expect(TAG_COLOR_PALETTE).toContainEqual(color);
        expect(color.bg).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('provides 12 distinct palette colors and distributes varied tags broadly', () => {
      expect(TAG_COLOR_PALETTE).toHaveLength(12);
      const uniqueBg = new Set(TAG_COLOR_PALETTE.map((c) => c.bg));
      expect(uniqueBg.size).toBe(12);

      const sampleTags = [
        'studia', 'projekt', 'egzamin', 'finanse', 'dom', 'hackathon', 'zdrowie', 'ćwiczenia',
        'algorytmy', 'sieci', 'bazy', 'fizyka', 'matematyka', 'angielski', 'praca', 'zakupy',
        'sport', 'książki', 'notatki', 'laboratorium', 'wykład', 'seminarium', 'stypendium',
        'rower', 'kawa', 'muzyka', 'podróż', 'rodzina', 'hobby', 'programowanie', 'rust', 'docker',
      ];
      const mappedColors = new Set(sampleTags.map((t) => getTagColor(t).bg));
      expect(mappedColors.size).toBeGreaterThanOrEqual(8);
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
