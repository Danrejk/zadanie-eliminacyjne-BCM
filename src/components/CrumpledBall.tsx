import { memo } from 'react';
import type { Priority } from '../types/task';

export interface CrumpledBallProps {
  priority: Priority;
  taskId: number;
  size?: number;
  className?: string;
}

interface BallPalette {
  base: string;
  mid: string;
  dark: string;
  crease: string;
  highlight: string;
}

const BALL_PALETTES: Record<Priority, BallPalette> = {
  wysoki: {
    base: '#ffccd5',
    mid: '#f4a4b4',
    dark: '#e58a9e',
    crease: '#a84e64',
    highlight: '#ffe8ed',
  },
  sredni: {
    base: '#fff3a1',
    mid: '#ebd874',
    dark: '#d9c255',
    crease: '#947e24',
    highlight: '#fffbe2',
  },
  niski: {
    base: '#c8f2e6',
    mid: '#9fdcc9',
    dark: '#7ec7b1',
    crease: '#438974',
    highlight: '#e8fcf6',
  },
};

const SILHOUETTES: readonly string[] = [
  'M24 3 L35 6 L43 15 L45 26 L39 38 L29 44 L17 43 L7 36 L4 24 L7 12 L15 5 Z',
  'M22 4 L34 5 L42 13 L44 25 L40 37 L30 43 L18 44 L8 35 L5 23 L8 11 L16 6 Z',
  'M25 3 L36 7 L44 16 L43 28 L38 39 L27 44 L16 42 L6 34 L4 22 L9 11 L17 5 Z',
  'M23 4 L33 6 L43 14 L45 27 L37 38 L28 43 L15 43 L6 33 L5 21 L10 10 L18 5 Z',
];

const CREASE_SETS: readonly (readonly string[])[] = [
  [
    'M15 8 L24 20 L35 12',
    'M9 22 L24 20 L18 35',
    'M24 20 L36 28 L29 41',
    'M13 15 L18 27 L10 33',
    'M30 17 L39 21',
  ],
  [
    'M12 12 L22 18 L34 9',
    'M7 24 L22 18 L27 33',
    'M22 18 L15 38',
    'M27 33 L39 26',
    'M29 14 L38 19',
  ],
  [
    'M18 7 L25 22 L37 15',
    'M8 19 L25 22 L14 33',
    'M25 22 L34 36',
    'M19 30 L26 41',
    'M12 13 L18 20',
  ],
  [
    'M14 9 L26 19 L38 13',
    'M8 25 L21 24 L26 19',
    'M21 24 L17 39',
    'M26 19 L37 31 L28 40',
    'M31 10 L28 16',
  ],
];

function getVariantIndex(taskId: number): number {
  const safeId = Number.isFinite(taskId) ? Math.trunc(taskId) : 0;
  const hash = Math.imul(safeId + 1, 2654435761) >>> 0;
  return hash % SILHOUETTES.length;
}

export const CrumpledBall = memo(function CrumpledBall({
  priority,
  taskId,
  size = 48,
  className = '',
}: CrumpledBallProps) {
  const palette = BALL_PALETTES[priority];
  const variant = getVariantIndex(taskId);
  const outerPath = SILHOUETTES[variant];
  const creases = CREASE_SETS[variant];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`select-none ${className}`}
    >
      {/* Lightweight baked SVG shadow (avoids per-ball WebRender drop-shadow blur) */}
      <ellipse cx="24" cy="44" rx="14" ry="2.8" fill="rgba(0, 0, 0, 0.24)" />

      {/* Outer crumpled paper silhouette */}
      <path
        d={outerPath}
        fill={palette.base}
        stroke={palette.dark}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Mid-tone shaded facets */}
      <polygon
        points="24,20 35,12 43,25 36,36 22,38"
        fill={palette.mid}
        opacity="0.72"
      />
      <polygon
        points="8,24 20,21 24,38 12,35"
        fill={palette.dark}
        opacity="0.38"
      />

      {/* Specular paper highlight facet */}
      <polygon
        points="15,7 28,8 23,19 11,16"
        fill={palette.highlight}
        opacity="0.82"
      />

      {/* Crisp crease lines */}
      {creases.map((d, idx) => (
        <path
          key={idx}
          d={d}
          stroke={palette.crease}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={idx < 3 ? 0.78 : 0.52}
        />
      ))}
    </svg>
  );
});
