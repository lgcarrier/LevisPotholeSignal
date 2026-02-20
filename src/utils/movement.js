const EARTH_RADIUS_METERS = 6371000
const MAX_SAMPLE_INTERVAL_MS = 30000

export const MOVEMENT_SPEED_THRESHOLD_KMH = 5
export const MOVEMENT_SPEED_THRESHOLD_MPS = MOVEMENT_SPEED_THRESHOLD_KMH / 3.6
export const DRIFT_DISTANCE_METERS = 6

export function toKmh(speedMps) {
  if (typeof speedMps !== 'number' || Number.isNaN(speedMps)) {
    return null
  }
  return speedMps * 3.6
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

export function haversineDistanceMeters(start, end) {
  if (!start || !end) {
    return null
  }

  const lat1 = toRadians(start.latitude)
  const lat2 = toRadians(end.latitude)
  const deltaLat = toRadians(end.latitude - start.latitude)
  const deltaLon = toRadians(end.longitude - start.longitude)

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

export function resolveMovementSpeed({
  coords,
  timestamp,
  previousSample,
  minDistanceMeters = DRIFT_DISTANCE_METERS,
}) {
  if (!coords) {
    return { speedMps: null, source: 'none' }
  }

  if (typeof coords.speed === 'number' && Number.isFinite(coords.speed) && coords.speed >= 0) {
    return { speedMps: coords.speed, source: 'sensor' }
  }

  if (!previousSample) {
    return { speedMps: null, source: 'none' }
  }

  const elapsedMs = timestamp - previousSample.timestamp
  if (elapsedMs <= 0 || elapsedMs > MAX_SAMPLE_INTERVAL_MS) {
    return { speedMps: null, source: 'none' }
  }

  const currentSample = {
    latitude: coords.latitude,
    longitude: coords.longitude,
  }

  const distanceMeters = haversineDistanceMeters(previousSample, currentSample)
  if (distanceMeters === null) {
    return { speedMps: null, source: 'none' }
  }

  if (distanceMeters < minDistanceMeters) {
    return { speedMps: 0, source: 'estimated' }
  }

  const speedMps = distanceMeters / (elapsedMs / 1000)
  return { speedMps, source: 'estimated' }
}

export function deriveMovementState({ moving, passengerConfirmed }) {
  if (!moving) {
    return 'stationary'
  }

  return passengerConfirmed ? 'passenger-confirmed' : 'moving'
}

export function movementStateLabel(state) {
  if (state === 'moving') {
    return 'Mouvement détecté'
  }
  if (state === 'passenger-confirmed') {
    return 'Passager confirmé'
  }
  return 'Stationnaire'
}
