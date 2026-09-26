export const DEFAULT_ADJUST = { zoom: 1, x: 0.5, y: 0.5 }
export const MIN_ZOOM = 1
export const MAX_ZOOM = 3

export function getAdjust(map, url) {
  const a = map?.[url]
  if (!a) return DEFAULT_ADJUST
  return {
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(a.zoom) || 1)),
    x: Math.min(1, Math.max(0, Number(a.x ?? 0.5))),
    y: Math.min(1, Math.max(0, Number(a.y ?? 0.5))),
  }
}

export function isAdjusted(a) {
  return a.zoom > 1.001
}

// Inline style for a photo inside a clipped frame. Zoom 1 shows the whole
// photo; above 1 it zooms in around the chosen point.
export function adjustStyle(a) {
  if (!a || !isAdjusted(a)) return undefined
  return {
    transform: `scale(${a.zoom})`,
    transformOrigin: `${a.x * 100}% ${a.y * 100}%`,
  }
}
