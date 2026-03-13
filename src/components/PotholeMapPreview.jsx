import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  buildGoogleMapsSearchUrl,
  DEFAULT_MAP_CENTER,
  resolveMapTileConfig,
} from '../utils/maps'

function formatCoordinate(value) {
  return Number(value).toFixed(5)
}

function buildMarkerIcon(point, isActive) {
  return L.divIcon({
    className: 'map-point-marker-shell',
    html: `<span class="map-point-marker ${isActive ? 'active' : ''}">${point.shortLabel}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    tooltipAnchor: [0, -20],
  })
}

function PotholeMapPreview({
  points,
  editingPointIndex,
  editingDraftPosition,
  onBeginPointEdit,
  onUpdatePointDraft,
  onConfirmPointMove,
  onCancelPointMove,
}) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerLayerRef = useRef(null)
  const previousEditingPointIndexRef = useRef(null)
  const { attribution, maxZoom, urlTemplate } = resolveMapTileConfig()
  const activePoint =
    editingPointIndex === null
      ? null
      : points.find((point) => point.sourceIndex === editingPointIndex) ?? null
  const isEditLocked = editingPointIndex !== null

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return undefined
    }

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false,
      zoomControl: false,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    L.tileLayer(urlTemplate, {
      attribution,
      maxZoom,
    }).addTo(map)

    markerLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      markerLayerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [attribution, maxZoom, urlTemplate])

  useEffect(() => {
    if (!mapRef.current || !markerLayerRef.current) {
      return undefined
    }

    const map = mapRef.current
    const markerLayer = markerLayerRef.current
    const previousEditingPointIndex = previousEditingPointIndexRef.current
    markerLayer.clearLayers()

    if (!points.length) {
      map.setView(DEFAULT_MAP_CENTER, 12)
      const frameId = window.requestAnimationFrame(() => map.invalidateSize())
      previousEditingPointIndexRef.current = editingPointIndex
      return () => window.cancelAnimationFrame(frameId)
    }

    const bounds = []

    points.forEach((point) => {
      const latlng = [point.latitude, point.longitude]
      const isEditingPoint = editingPointIndex === point.sourceIndex
      const marker = L.marker(latlng, {
        icon: buildMarkerIcon(point, isEditingPoint),
        draggable: isEditingPoint,
        autoPan: isEditingPoint,
        riseOnHover: true,
      })

      marker.on('click', () => {
        if (editingPointIndex === null || editingPointIndex === point.sourceIndex) {
          onBeginPointEdit(point.sourceIndex)
        }
      })

      if (isEditingPoint) {
        marker.on('dragend', (event) => {
          const { lat, lng } = event.target.getLatLng()
          onUpdatePointDraft(point.sourceIndex, {
            latitude: lat,
            longitude: lng,
          })
        })
      }

      marker.bindTooltip(
        `${point.label}<br />Lat: ${formatCoordinate(point.latitude)}, Long: ${formatCoordinate(point.longitude)}`,
        {
          direction: 'top',
          offset: [0, -20],
        }
      )
      marker.addTo(markerLayer)
      bounds.push(latlng)
    })

    if (editingPointIndex === null) {
      if (points.length === 1) {
        map.setView(bounds[0], 16)
      } else {
        map.fitBounds(bounds, {
          padding: [28, 28],
          maxZoom: 16,
        })
      }
    } else if (activePoint && previousEditingPointIndex !== editingPointIndex) {
      map.panTo([activePoint.latitude, activePoint.longitude], {
        animate: false,
      })
    }

    const frameId = window.requestAnimationFrame(() => map.invalidateSize())
    previousEditingPointIndexRef.current = editingPointIndex
    return () => window.cancelAnimationFrame(frameId)
  }, [activePoint, editingPointIndex, onBeginPointEdit, onUpdatePointDraft, points])

  return (
    <section className="surface-card map-preview-card">
      <div className="row-between map-preview-header">
        <div>
          <p className="section-kicker">Carte</p>
          <h2>Voir les points selectionnes</h2>
        </div>
        <p className="map-preview-note">
          Touchez un point pour l&apos;ajuster. Google Maps s&apos;ouvre dans
          l&apos;application si disponible.
        </p>
      </div>

      <div
        ref={mapContainerRef}
        className={`map-preview-canvas ${points.length === 0 ? 'empty' : ''}`}
        aria-label={`${points.length} points affiches sur la carte`}
      />

      {activePoint && editingDraftPosition && (
        <div className="map-edit-panel">
          <p className="inline-note">
            Faites glisser {activePoint.label}, puis confirmez son nouvel emplacement.
          </p>
          <div className="map-edit-actions">
            <button
              type="button"
              className="primary-cta accent"
              onClick={onConfirmPointMove}
            >
              Confirmer le point
            </button>
            <button
              type="button"
              className="secondary-cta"
              onClick={onCancelPointMove}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {points.length > 0 ? (
        <div className="map-preview-links">
          {points.map((point) => {
            const isEditingPoint = editingPointIndex === point.sourceIndex

            return (
              <article
                key={point.sourceIndex}
                className={`map-point-card ${isEditingPoint ? 'editing' : ''}`}
              >
                <div className="map-point-card-header">
                  <div className="map-point-card-heading">
                    <span className={`map-point-pill ${isEditingPoint ? 'active' : ''}`}>
                      {point.shortLabel}
                    </span>
                    <div className="map-point-card-title">
                      <strong>{point.label}</strong>
                      <span>
                        {isEditingPoint
                          ? 'Ajustement en cours sur la carte'
                          : 'Point pret a etre verifie ou ouvert dans Google Maps'}
                      </span>
                    </div>
                  </div>

                  {isEditingPoint && <span className="map-point-state">Actif</span>}
                </div>

                <div className="map-point-card-meta" aria-label={`Coordonnees de ${point.label}`}>
                  <span className="map-point-coordinate">Lat {formatCoordinate(point.latitude)}</span>
                  <span className="map-point-coordinate">Long {formatCoordinate(point.longitude)}</span>
                </div>

                <div className="map-point-card-actions">
                  <button
                    type="button"
                    className={`secondary-chip map-point-chip ${isEditingPoint ? 'active' : ''}`}
                    onClick={() => onBeginPointEdit(point.sourceIndex)}
                    disabled={isEditLocked && !isEditingPoint}
                  >
                    {isEditingPoint ? 'Ajustement actif' : 'Ajuster le point'}
                  </button>

                  {isEditingPoint ? (
                    <span className="map-point-status">Ajustement en cours</span>
                  ) : (
                    <a
                      className="inline-link map-point-link"
                      href={buildGoogleMapsSearchUrl(point)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Ouvrir ${point.label} dans Google Maps`}
                    >
                      Google Maps
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="inline-note">Selectionnez au moins un point pour afficher la carte.</p>
      )}
    </section>
  )
}

export default PotholeMapPreview
