import assert from 'node:assert/strict'
import test from 'node:test'

import { updatePotholePosition } from '../src/utils/potholes.js'

test('updatePotholePosition replaces only the targeted point coordinates', () => {
  const potholes = [
    {
      latitude: 46.8123,
      longitude: -71.1776,
      simulated: false,
      timestamp: '2026-03-12T10:00:00.000Z',
    },
    {
      latitude: 46.8135,
      longitude: -71.1702,
      simulated: true,
      timestamp: '2026-03-12T10:01:00.000Z',
    },
  ]

  const updated = updatePotholePosition(potholes, 1, {
    latitude: 46.814,
    longitude: -71.169,
  })

  assert.notEqual(updated, potholes)
  assert.deepEqual(updated[0], potholes[0])
  assert.equal(updated[1].latitude, 46.814)
  assert.equal(updated[1].longitude, -71.169)
  assert.equal(updated[1].simulated, true)
  assert.equal(updated[1].timestamp, '2026-03-12T10:01:00.000Z')
})

test('updatePotholePosition returns the original list for an invalid index', () => {
  const potholes = [{ latitude: 46.8123, longitude: -71.1776 }]

  const updated = updatePotholePosition(potholes, 2, {
    latitude: 46.814,
    longitude: -71.169,
  })

  assert.equal(updated, potholes)
})
