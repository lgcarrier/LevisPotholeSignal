import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_MAP_TILE_ATTRIBUTION,
  DEFAULT_MAP_TILE_MAX_ZOOM,
  DEFAULT_MAP_TILE_URL,
  buildGoogleMapsSearchUrl,
  resolveMapTileConfig,
} from '../src/utils/maps.js'

test('buildGoogleMapsSearchUrl creates a Google Maps search link for a coordinate pair', () => {
  const url = buildGoogleMapsSearchUrl({
    latitude: 46.8123,
    longitude: -71.1776,
  })

  assert.equal(
    url,
    'https://www.google.com/maps/search/?api=1&query=46.8123%2C-71.1776'
  )
})

test('resolveMapTileConfig falls back to the default OpenStreetMap tiles', () => {
  assert.deepEqual(resolveMapTileConfig({}), {
    urlTemplate: DEFAULT_MAP_TILE_URL,
    attribution: DEFAULT_MAP_TILE_ATTRIBUTION,
    maxZoom: DEFAULT_MAP_TILE_MAX_ZOOM,
  })
})

test('resolveMapTileConfig respects explicit tile overrides', () => {
  assert.deepEqual(
    resolveMapTileConfig({
      VITE_MAP_TILE_URL: 'https://tiles.example.com/{z}/{x}/{y}.png',
      VITE_MAP_TILE_ATTRIBUTION: 'Example Tiles',
      VITE_MAP_TILE_MAX_ZOOM: '17',
    }),
    {
      urlTemplate: 'https://tiles.example.com/{z}/{x}/{y}.png',
      attribution: 'Example Tiles',
      maxZoom: 17,
    }
  )
})
