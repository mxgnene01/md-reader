export const DEFAULT_SIDE_WIDTH = 260
export const MIN_SIDE_WIDTH = 200
export const MAX_SIDE_WIDTH = 720

/** Space kept for the article when the window is too narrow for the wanted width. */
const MIN_CONTENT_WIDTH = 360

/** Bounds the stored preference. An absent or unusable value falls back to the default. */
export function resolveSideWidth(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SIDE_WIDTH
  }
  return Math.min(Math.max(Math.round(value), MIN_SIDE_WIDTH), MAX_SIDE_WIDTH)
}

/** Keeps the sidebar from squeezing the article out of a small window. */
export function clampSideWidthForViewport(
  width: number,
  viewportWidth: number = window.innerWidth,
): number {
  const max = Math.max(
    MIN_SIDE_WIDTH,
    Math.min(MAX_SIDE_WIDTH, viewportWidth - MIN_CONTENT_WIDTH),
  )
  return Math.min(Math.max(width, MIN_SIDE_WIDTH), max)
}
