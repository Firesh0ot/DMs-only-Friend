export type ScreenCarouselPlacement = {
  xNorm: number;
  yNorm: number;
};

export const DEFAULT_SCREEN_CAROUSEL: ScreenCarouselPlacement = {
  xNorm: 0.5,
  yNorm: 0.88,
};

export const SCREEN_CAROUSEL_PRESETS = {
  south: { xNorm: 0.5, yNorm: 0.88 },
  north: { xNorm: 0.5, yNorm: 0.12 },
  west: { xNorm: 0.12, yNorm: 0.5 },
  east: { xNorm: 0.88, yNorm: 0.5 },
} as const satisfies Record<string, ScreenCarouselPlacement>;

export function clampCarouselPlacement(
  placement: ScreenCarouselPlacement,
): ScreenCarouselPlacement {
  return {
    xNorm: Math.min(1, Math.max(0, placement.xNorm)),
    yNorm: Math.min(1, Math.max(0, placement.yNorm)),
  };
}

export function carouselFacingDeg(placement: ScreenCarouselPlacement): number {
  const dx = 0.5 - placement.xNorm;
  const dy = 0.5 - placement.yNorm;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return 0;
  }
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}
