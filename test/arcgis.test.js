import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildArcGisAddsPayload,
  formatArcGisName,
  isSuccessfulArcGisAddResponse,
  projectToWebMercator,
} from '../src/utils/arcgis.js'

test('projectToWebMercator converts Levis GPS coordinates to Web Mercator meters', () => {
  const projected = projectToWebMercator({
    latitude: 46.8123,
    longitude: -71.1776,
  })

  assert.equal(projected.spatialReference.wkid, 102100)
  assert.ok(Math.abs(projected.x - -7923454.19) < 1)
  assert.ok(Math.abs(projected.y - 5911490.29) < 1)
})

test('buildArcGisAddsPayload keeps ArcGIS attributes and projected geometry', () => {
  const payload = buildArcGisAddsPayload(
    [{ latitude: 46.8123, longitude: -71.1776 }],
    {
      firstName: 'Louis-Guillaume',
      lastName: 'Carrier-Bedard',
      email: 'lgcarrier@gmail.com',
    }
  )

  assert.equal(payload.length, 1)
  assert.equal(payload[0].attributes.Nom, 'Carrier-Bedard Louis-Guillaume')
  assert.equal(payload[0].attributes.courriel, 'lgcarrier@gmail.com')
  assert.equal(payload[0].attributes.Statut, 'Signale')
  assert.ok(Math.abs(payload[0].geometry.x) > 1000000)
  assert.ok(Math.abs(payload[0].geometry.y) > 1000000)
})

test('formatArcGisName orders last name before first name', () => {
  assert.equal(
    formatArcGisName({
      firstName: 'Louis-Guillaume',
      lastName: 'Carrier-Bedard',
    }),
    'Carrier-Bedard Louis-Guillaume'
  )
})

test('isSuccessfulArcGisAddResponse validates count and success flags', () => {
  assert.equal(
    isSuccessfulArcGisAddResponse(
      {
        addResults: [
          { success: true, objectId: 1 },
          { success: true, objectId: 2 },
        ],
      },
      2
    ),
    true
  )

  assert.equal(
    isSuccessfulArcGisAddResponse(
      {
        addResults: [{ success: true, objectId: 1 }],
      },
      2
    ),
    false
  )
})
