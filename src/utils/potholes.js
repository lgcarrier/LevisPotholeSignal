export function updatePotholePosition(potholes, index, nextCoordinates) {
  if (!Array.isArray(potholes) || !nextCoordinates) {
    return potholes
  }

  if (index < 0 || index >= potholes.length) {
    return potholes
  }

  return potholes.map((pothole, potholeIndex) =>
    potholeIndex === index
      ? {
          ...pothole,
          latitude: nextCoordinates.latitude,
          longitude: nextCoordinates.longitude,
        }
      : pothole
  )
}
