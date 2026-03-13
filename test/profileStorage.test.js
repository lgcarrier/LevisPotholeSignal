import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LEGACY_PROFILE_STORAGE_KEY,
  persistProfile,
  PROFILE_SESSION_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  readStoredProfile,
} from '../src/utils/profileStorage.js'

function createStorage() {
  const data = new Map()

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

test('persistProfile keeps a session copy and optional remembered copy', () => {
  const sessionStorage = createStorage()
  const localStorage = createStorage()
  const now = Date.UTC(2026, 2, 12)

  const normalizedProfile = persistProfile({
    profile: {
      firstName: '  Lea ',
      lastName: ' Tremblay ',
      email: ' lea@example.com ',
    },
    rememberProfile: true,
    sessionStorage,
    localStorage,
    now,
  })

  assert.deepEqual(normalizedProfile, {
    firstName: 'Lea',
    lastName: 'Tremblay',
    email: 'lea@example.com',
  })

  const sessionPayload = JSON.parse(sessionStorage.getItem(PROFILE_SESSION_STORAGE_KEY))
  assert.equal(sessionPayload.rememberProfile, true)
  assert.deepEqual(sessionPayload.profile, normalizedProfile)

  const rememberedPayload = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY))
  assert.equal(rememberedPayload.rememberProfile, true)
  assert.deepEqual(rememberedPayload.profile, normalizedProfile)
  assert.ok(rememberedPayload.expiresAt > now)
})

test('persistProfile removes remembered local data when rememberProfile is false', () => {
  const sessionStorage = createStorage()
  const localStorage = createStorage()

  localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      rememberProfile: true,
      expiresAt: Date.UTC(2026, 3, 12),
      profile: {
        firstName: 'Lea',
        lastName: 'Tremblay',
        email: 'lea@example.com',
      },
    })
  )

  persistProfile({
    profile: {
      firstName: 'Lea',
      lastName: 'Tremblay',
      email: 'lea@example.com',
    },
    rememberProfile: false,
    sessionStorage,
    localStorage,
  })

  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), null)
  const sessionPayload = JSON.parse(sessionStorage.getItem(PROFILE_SESSION_STORAGE_KEY))
  assert.equal(sessionPayload.rememberProfile, false)
})

test('readStoredProfile migrates the legacy local profile into a session-only profile', () => {
  const sessionStorage = createStorage()
  const localStorage = createStorage()

  localStorage.setItem(
    LEGACY_PROFILE_STORAGE_KEY,
    JSON.stringify({
      firstName: 'Lea',
      lastName: 'Tremblay',
      email: 'lea@example.com',
    })
  )

  const storedProfile = readStoredProfile({
    sessionStorage,
    localStorage,
    now: Date.UTC(2026, 2, 12),
  })

  assert.deepEqual(storedProfile, {
    profile: {
      firstName: 'Lea',
      lastName: 'Tremblay',
      email: 'lea@example.com',
    },
    rememberProfile: false,
    source: 'legacy',
  })
  assert.equal(localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY), null)

  const sessionPayload = JSON.parse(sessionStorage.getItem(PROFILE_SESSION_STORAGE_KEY))
  assert.equal(sessionPayload.rememberProfile, false)
  assert.deepEqual(sessionPayload.profile, storedProfile.profile)
})

test('readStoredProfile drops expired remembered profiles', () => {
  const sessionStorage = createStorage()
  const localStorage = createStorage()

  localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      rememberProfile: true,
      expiresAt: Date.UTC(2026, 1, 12),
      profile: {
        firstName: 'Lea',
        lastName: 'Tremblay',
        email: 'lea@example.com',
      },
    })
  )

  const storedProfile = readStoredProfile({
    sessionStorage,
    localStorage,
    now: Date.UTC(2026, 2, 12),
  })

  assert.equal(storedProfile, null)
  assert.equal(localStorage.getItem(PROFILE_STORAGE_KEY), null)
  assert.equal(sessionStorage.getItem(PROFILE_SESSION_STORAGE_KEY), null)
})
