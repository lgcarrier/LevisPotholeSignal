export const DEFAULT_MAP_CENTER = [46.8123, -71.1776]
export const DEFAULT_MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const DEFAULT_MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const DEFAULT_MAP_TILE_MAX_ZOOM = 19

export function buildGoogleMapsSearchUrl({ latitude, longitude }) {
  const coordinates = `${Number(latitude)},${Number(longitude)}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`
}

export function resolveMapTileConfig(env = import.meta.env ?? {}) {
  const parsedMaxZoom = Number(env.VITE_MAP_TILE_MAX_ZOOM)
  const maxZoom =
    Number.isFinite(parsedMaxZoom) && parsedMaxZoom > 0
      ? parsedMaxZoom
      : DEFAULT_MAP_TILE_MAX_ZOOM

  return {
    urlTemplate: env.VITE_MAP_TILE_URL || DEFAULT_MAP_TILE_URL,
    attribution: env.VITE_MAP_TILE_ATTRIBUTION || DEFAULT_MAP_TILE_ATTRIBUTION,
    maxZoom,
  }
}
