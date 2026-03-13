const WEB_MERCATOR_WKID = 102100
const WEB_MERCATOR_RADIUS_METERS = 6378137
const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066

function clampLatitude(latitude) {
  return Math.max(Math.min(latitude, WEB_MERCATOR_MAX_LATITUDE), -WEB_MERCATOR_MAX_LATITUDE)
}

export function projectToWebMercator({ latitude, longitude }) {
  const clampedLatitude = clampLatitude(latitude)
  const longitudeRadians = (longitude * Math.PI) / 180
  const latitudeRadians = (clampedLatitude * Math.PI) / 180

  return {
    x: WEB_MERCATOR_RADIUS_METERS * longitudeRadians,
    y: WEB_MERCATOR_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)),
    spatialReference: { wkid: WEB_MERCATOR_WKID },
  }
}

export function formatArcGisName(userSettings) {
  return `${userSettings.lastName.trim()} ${userSettings.firstName.trim()}`
}

export function buildArcGisAddsPayload(potholes, userSettings) {
  return potholes.map((pothole) => ({
    geometry: projectToWebMercator(pothole),
    attributes: {
      Nom: formatArcGisName(userSettings),
      courriel: userSettings.email,
      Statut: 'Signale',
    },
  }))
}

export function isSuccessfulArcGisAddResponse(result, expectedCount) {
  if (!Array.isArray(result?.addResults)) {
    return false
  }

  return (
    result.addResults.length === expectedCount &&
    result.addResults.every((entry) => entry?.success === true)
  )
}
