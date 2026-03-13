# Security Best Practices Report

## Executive summary

This repository is a client-side React/Vite app that collects precise GPS coordinates plus user identity data, then can submit reports directly to a third-party ArcGIS write endpoint. The highest-risk issues are integrity abuse of the live submission path, privacy exposure from browser-side persistence and logging, and the lack of repo-visible browser hardening for a static deployment.

## High severity

### SBP-001: Live ArcGIS submissions rely on client-side controls only

Impact: If the ArcGIS layer accepts the unauthenticated request shape shown here, any visitor or script can forge pothole reports, spoof reporter identity, and automate spam against the downstream dataset.

- Rule ID: FRONTEND-INTEGRITY-001
- Severity: High
- Location:
  - `src/App.jsx:14-16`
  - `src/App.jsx:755-776`
  - `src/utils/arcgis.js:25-33`
  - `README.md:58-60`
  - `README.md:121-139`
- Evidence:

```js
const ARCGIS_ENDPOINT =
  'https://services1.arcgis.com/niuNnVx0H92jOc5F/arcgis/rest/services/NidDePouleSignale/FeatureServer/0/applyEdits'
const REAL_SUBMISSION_ENABLED = import.meta.env.VITE_ALLOW_REAL_SUBMISSION === 'true'
```

```js
const response = await fetch(ARCGIS_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
})
```

```js
attributes: {
  Nom: formatArcGisName(userSettings),
  courriel: userSettings.email,
  Statut: 'Signale',
},
```

- Impact details:
  - `VITE_ALLOW_REAL_SUBMISSION` and `window.confirm(...)` are browser-side switches, not trust boundaries.
  - The request body contains caller-supplied name, email, and coordinates with no repo-visible authentication, authorization, signature, CAPTCHA, or rate limiting.
- Fix:
  - Move live writes behind a controlled backend or serverless function.
  - Enforce authentication or at least abuse controls there: rate limiting, CAPTCHA, schema validation, and audit logging.
  - Prefer server-minted short-lived tokens or signed requests over direct browser writes to the ArcGIS edit endpoint.
- Mitigation:
  - Keep `VITE_ALLOW_REAL_SUBMISSION=false` outside tightly controlled demos.
  - Monitor downstream ArcGIS edits for spikes, duplicate payloads, or impossible coordinate patterns.
- False positive notes:
  - If ArcGIS already enforces auth, origin restrictions, or rate limits outside this repo, the priority drops. Those controls are not visible here.

## Medium severity

### SBP-002: User identity data persists in browser storage without expiry or opt-in

- Rule ID: FRONTEND-STORAGE-001
- Severity: Medium
- Location:
  - `src/App.jsx:77-97`
  - `src/App.jsx:107-123`
  - `src/App.jsx:454-482`
  - `README.md:39`
- Evidence:

```js
const savedSettings = localStorage.getItem(PROFILE_STORAGE_KEY)
```

```js
localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalizedProfile))
```

```js
sessionStorage.setItem(
  SAFETY_CONSENT_STORAGE_KEY,
  JSON.stringify({
    acceptedAt,
    role,
  })
)
```

- Impact:
  - `localStorage` data survives browser restarts and is readable by any script that executes in this origin, including future XSS or hostile extensions.
  - Shared-device users can leave reporter identity behind long after the reporting session ends.
- Fix:
  - Default to in-memory or session-only storage for name/email.
  - If persistence is needed, add an explicit "remember me on this device" control plus a short retention window and clear-storage action.
  - Document the privacy tradeoff because this app also processes precise location data.
- Mitigation:
  - Clear stored profile data after successful submission or when the user starts a new session.
  - Avoid treating browser storage as trusted input; continue validating parsed values.
- False positive notes:
  - Risk is lower on single-user managed devices, but browser storage remains recoverable by any same-origin script.

### SBP-003: Simulation mode logs reporter identity and precise coordinates to the browser console

- Rule ID: FRONTEND-LOGGING-001
- Severity: Medium
- Location:
  - `src/App.jsx:739-743`
- Evidence:

```js
console.log('Safe Mode - Simulated API Call:', {
  user: userSettings,
  potholes: selectedPotholes,
})
```

- Impact:
  - The default simulation path emits full reporter identity plus selected GPS coordinates into devtools.
  - That data can leak during screen sharing, remote debugging, kiosk usage, or extension-based telemetry collection.
- Fix:
  - Remove the log from production bundles, or guard it behind `import.meta.env.DEV`.
  - If diagnostics are required, redact email and round coordinates before logging.
- Mitigation:
  - Add a lint rule or review check that blocks production logging of location or PII.
- False positive notes:
  - This is less severe than a network leak, but it is a recurring privacy footgun because simulation mode is the default path.

### SBP-004: Static deployment has no repo-visible CSP, clickjacking defense, or referrer policy

- Rule ID: FRONTEND-HEADERS-001
- Severity: Medium
- Location:
  - `index.html:1-10`
  - `netlify.toml:1-3`
- Evidence:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signalement de nids-de-poule sur le territoire de la ville de Lévis (Québec).</title>
</head>
```

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

- Impact:
  - A future XSS bug would have no repo-visible CSP to reduce blast radius.
  - The app can likely be framed unless Netlify or another edge layer adds `frame-ancestors` or `X-Frame-Options`.
  - Outbound map links may send more referrer information than necessary unless the edge sets a policy.
- Fix:
  - Configure Netlify response headers for at least CSP, `frame-ancestors 'none'`, `Referrer-Policy`, and `X-Content-Type-Options`.
  - If header control is impossible, add a restrictive CSP meta tag early in `index.html` and document its limits.
- Mitigation:
  - Verify deployed headers with a browser/network capture because edge/CDN config may exist outside the repo.
- False positive notes:
  - This finding should be downgraded if those headers are already injected by infrastructure not represented here.

## Low severity / watchlist

### SBP-005: Leaflet rendering uses raw HTML sinks that are safe today but brittle for future changes

- Rule ID: FRONTEND-XSS-001
- Severity: Low
- Location:
  - `src/components/PotholeMapPreview.jsx:14-18`
  - `src/components/PotholeMapPreview.jsx:116-118`
  - `src/utils/maps.js:19-21`
- Evidence:

```js
html: `<span class="map-point-marker ${isActive ? 'active' : ''}">${point.shortLabel}</span>`,
```

```js
marker.bindTooltip(
  `${point.label}<br />Lat: ${formatCoordinate(point.latitude)}, Long: ${formatCoordinate(point.longitude)}`,
```

```js
attribution: env.VITE_MAP_TILE_ATTRIBUTION || DEFAULT_MAP_TILE_ATTRIBUTION,
```

- Impact:
  - The current inputs are internally generated labels, numbers, or operator-controlled environment values, so this is not a proven exploitable XSS path today.
  - The component becomes high risk quickly if future changes allow user-controlled labels, remote HTML, or unreviewed `VITE_MAP_TILE_ATTRIBUTION` values.
- Fix:
  - Keep marker labels numeric/internal only.
  - Sanitize any future HTML-bearing content before handing it to Leaflet.
  - Treat tile attribution overrides as trusted-deployment-only inputs and validate them during build/review.
- Mitigation:
  - Add comments or tests documenting that these HTML sinks must never receive user-controlled strings.

## Verification

- `npm test`: passed (9/9 tests)
- `npm run lint`: passed
- `npm run build`: passed
