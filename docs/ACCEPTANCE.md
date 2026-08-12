# Milestone 1 acceptance

This checklist is the merge gate for **Map v0.1 — Vilnius PWA**. Automated checks may be recorded by
CI or a Windows development run. Physical-device checks must be completed manually by the user; they
must never be inferred from desktop emulation.

## Automated and Windows checks

- [ ] `scripts/setup.ps1` and `scripts/start.ps1` start the Windows stack successfully.
- [ ] `scripts/health.ps1` verifies the same-origin API health and Vilnius config endpoints.
- [ ] PostGIS reports its enabled version and the seeded Vilnius boundary exists.
- [ ] Martin serves the `vilnius_boundary` vector tile.
- [ ] The desktop PWA renders Vilnius and MapLibre pan/zoom controls work.
- [ ] The responsive layout fits a mobile-size browser viewport and respects safe areas.
- [ ] The manifest, service worker, Apple touch icon, and install icons are served.
- [ ] OpenStreetMap attribution remains visible on the map.
- [ ] Frontend lint, typecheck, tests, production build, backend lint/tests, and Compose validation pass.

## Manual LAN and physical-iPhone checks

- [ ] HTTPS opens successfully from another device on the same LAN.
- [ ] `/local-ca.mobileconfig` shows **Profile Downloaded** and **Map Local Development CA** can be
  installed and trusted on the iPhone.
- [ ] Map opens in iPhone Safari over the printed HTTPS URL without a certificate warning.
- [ ] Safari can add Map to the iPhone Home Screen with **Open as Web App** enabled.
- [ ] The installed Map launches in standalone mode rather than normal Safari chrome.
- [ ] Pan, pinch zoom, and rotation work on the physical iPhone.
- [ ] One-shot geolocation permission works when allowed; location is not continuously tracked or sent.
- [ ] OpenStreetMap attribution is visible on the physical iPhone.

Passing automation does not mark the manual section complete. PR #1 is technically merge-ready only
after the user records successful physical-iPhone acceptance.
