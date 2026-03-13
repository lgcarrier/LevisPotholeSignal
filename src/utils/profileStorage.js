export const LEGACY_PROFILE_STORAGE_KEY = 'userSettings'
export const PROFILE_STORAGE_KEY = 'userSettings.v2'
export const PROFILE_SESSION_STORAGE_KEY = 'userSettings.session.v2'
export const PROFILE_REMEMBER_DURATION_DAYS = 30

const PROFILE_REMEMBER_DURATION_MS = PROFILE_REMEMBER_DURATION_DAYS * 24 * 60 * 60 * 1000

function hasCompleteProfile(profile) {
  return Boolean(profile?.firstName?.trim() && profile?.lastName?.trim() && profile?.email?.trim())
}

function normalizeProfile(profile) {
  return {
    firstName: profile?.firstName?.trim() ?? '',
    lastName: profile?.lastName?.trim() ?? '',
    email: profile?.email?.trim() ?? '',
  }
}

function readJson(storage, key) {
  if (!storage) {
    return null
  }

  try {
    const rawValue = storage.getItem(key)
    if (!rawValue) {
      return null
    }

    return JSON.parse(rawValue)
  } catch {
    return null
  }
}

function removeKey(storage, key) {
  if (!storage) {
    return
  }

  try {
    storage.removeItem(key)
  } catch {
    // Storage cleanup is best effort only.
  }
}

function writeJson(storage, key, value) {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function syncSessionProfile(sessionStorage, profile, rememberProfile) {
  writeJson(sessionStorage, PROFILE_SESSION_STORAGE_KEY, {
    profile,
    rememberProfile,
  })
}

export function readStoredProfile({
  sessionStorage = globalThis.sessionStorage,
  localStorage = globalThis.localStorage,
  now = Date.now(),
} = {}) {
  const sessionPayload = readJson(sessionStorage, PROFILE_SESSION_STORAGE_KEY)
  if (hasCompleteProfile(sessionPayload?.profile)) {
    return {
      profile: normalizeProfile(sessionPayload.profile),
      rememberProfile: sessionPayload.rememberProfile === true,
      source: 'session',
    }
  }

  const rememberedPayload = readJson(localStorage, PROFILE_STORAGE_KEY)
  if (rememberedPayload) {
    if (!Number.isFinite(rememberedPayload.expiresAt) || rememberedPayload.expiresAt <= now) {
      removeKey(localStorage, PROFILE_STORAGE_KEY)
    } else if (rememberedPayload.rememberProfile === true && hasCompleteProfile(rememberedPayload.profile)) {
      const normalizedProfile = normalizeProfile(rememberedPayload.profile)
      syncSessionProfile(sessionStorage, normalizedProfile, true)

      return {
        profile: normalizedProfile,
        rememberProfile: true,
        source: 'local',
      }
    }
  }

  const legacyProfile = readJson(localStorage, LEGACY_PROFILE_STORAGE_KEY)
  if (hasCompleteProfile(legacyProfile)) {
    const normalizedProfile = normalizeProfile(legacyProfile)
    removeKey(localStorage, LEGACY_PROFILE_STORAGE_KEY)
    syncSessionProfile(sessionStorage, normalizedProfile, false)

    return {
      profile: normalizedProfile,
      rememberProfile: false,
      source: 'legacy',
    }
  }

  return null
}

export function persistProfile({
  profile,
  rememberProfile = false,
  sessionStorage = globalThis.sessionStorage,
  localStorage = globalThis.localStorage,
  now = Date.now(),
} = {}) {
  const normalizedProfile = normalizeProfile(profile)
  if (!hasCompleteProfile(normalizedProfile)) {
    return null
  }

  syncSessionProfile(sessionStorage, normalizedProfile, rememberProfile)
  removeKey(localStorage, LEGACY_PROFILE_STORAGE_KEY)

  if (rememberProfile) {
    writeJson(localStorage, PROFILE_STORAGE_KEY, {
      profile: normalizedProfile,
      rememberProfile: true,
      expiresAt: now + PROFILE_REMEMBER_DURATION_MS,
    })
  } else {
    removeKey(localStorage, PROFILE_STORAGE_KEY)
  }

  return normalizedProfile
}
