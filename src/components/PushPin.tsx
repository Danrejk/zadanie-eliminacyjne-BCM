import React from 'react';
import { getTagColor, normalizeTag } from '../utils/tagColors';

export interface PushPinProps {
  taskId: number;
  tags: readonly string[];
}

/**
 * Computes the horizontal percentage position [12..88] for pin `index` out of `count`.
 * Exported for deterministic unit testing.
 */
export function computePinLeftPercent(index: number, count: number): number {
  if (count <= 1) {
    return 50;
  }
  const edgePad = count === 2 ? 28 : count === 3 ? 20 : count === 4 ? 16 : 12;
  const span = 100 - 2 * edgePad;
  return Math.round((edgePad + (index / (count - 1)) * span) * 100) / 100;
}

function PushPinComponent({ taskId, tags }: PushPinProps) {
  if (tags.length === 0) {
    return (
      <div
        className="pushpin-strip"
        aria-label="Przypięcie notatki"
      >
        <div
          className="pushpin-anchor"
          style={{ left: '50%' }}
        >
          <div
            data-testid={`nail-pin-${taskId}`}
            title="Gwoździk (brak tagów)"
            aria-label="Gwoździk (brak tagów)"
            className="pushpin-nail pushpin-enter"
          >
            <span className="pushpin-nail-hole" aria-hidden="true" />
            <span className="pushpin-nail-shaft" aria-hidden="true" />
            <span className="pushpin-nail-head" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }

  const sizeClass =
    tags.length >= 7
      ? 'pushpin-head--xs'
      : tags.length >= 5
        ? 'pushpin-head--sm'
        : 'pushpin-head--md';

  return (
    <div
      className="pushpin-strip"
      aria-label="Pinezki tagów"
    >
      {tags.map((tag, index) => {
        const color = getTagColor(tag);
        const normalized = normalizeTag(tag);
        const leftPercent = computePinLeftPercent(index, tags.length);
        const tooltipId = `pushpin-tooltip-${taskId}-${index}`;

        return (
          <div
            key={`${normalized}-${index}`}
            className="pushpin-anchor"
            style={{ left: `${leftPercent}%` }}
          >
            <div
              data-testid={`pushpin-${taskId}-${index}`}
              data-tag={normalized}
              data-color={color.bg}
              title={tag}
              aria-label={`Tag: ${tag} (${color.name})`}
              aria-describedby={tooltipId}
              className={`pushpin-item pushpin-enter ${sizeClass}`}
            >
              <span
                className="pushpin-needle-shadow"
                aria-hidden="true"
              />
              <span
                className="pushpin-sphere"
                style={{
                  background: `radial-gradient(circle at 32% 30%, ${color.light} 0%, ${color.bg} 55%, ${color.dark} 100%)`,
                  borderColor: color.dark,
                }}
                aria-hidden="true"
              >
                <span className="pushpin-specular" />
              </span>
              <span
                id={tooltipId}
                role="tooltip"
                className="pushpin-tooltip"
              >
                <span
                  className="pushpin-tooltip-dot"
                  style={{ backgroundColor: color.bg }}
                  aria-hidden="true"
                />
                {tag}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const PushPin = React.memo(PushPinComponent);
export default PushPin;
