# Phase 2 — Vessel profile and QR identification

## Verified baseline
[Phase 1.4 CI](https://github.com/Ruzz-1010/MPGE-PCG-SYSTEM/actions/runs/45643388776) passed for 8d6d3166034abe4e39bcf4a569e2782e2754b16f: 3 unit + 6 integration groups, 0 failures/skips. No baseline defect was reported by CI.

## Requirements mapping (Requirements Analysis V2.0)
- FR-01.01–03: registration, generated internal ID, name/registration/ID search, station/status/type filters and 50-row pagination. Existing array API response remains supported; format=page returns rows,total,page,pageSize.
- FR-01.04: scoped linked read-only summaries, 50 latest documents/inspections, separate date and verification status, demo clearance on current inspection revision. No attachment downloads or operational write APIs. Empty results mean no authorized records, not valid clearance.
- FR-01.05–06: authorized profile editing, version conflicts, snapshots and audit trail, normalized registration uniqueness and conservative name duplicate blocking. Review/override workflow pending stakeholder policy.
- FR-01.07: inactive status and QR revocation; formal archival/retention workflow pending approved policy.
- FR-02.01–05: automatic QR issuance, display, print, PNG download, camera and local image decoding (jsQR), manual payload and registry lookup, revoked/unknown rejection, authorization at resolution. QR contains only VW1:opaque UUID, never owner details or an authentication credential. QR replacement/revocation requires a reason and is audited. Migration 005 backfills active profiles and adds an ordering index; no new tables/columns.
- Inactive profile revokes QR; reactivation issues a new token. Manual revocation of an active profile intentionally leaves no active code until reissue.
- Station/records roles may create/edit/replace/revoke within assigned station; regional read across all; inspector read own scope; technical no registry. Linked inspections are limited to regional/assigned station and role-appropriate workflow state (reviewed, own inspection for inspector, or authorized regional/station administrator). Cross-station access pending approval.
- Expiry date comparison uses Asia/Manila and 30-day upcoming threshold; validity-by-date is separate from verification. No automatic hold, enforcement or live tracking.

## API additions
GET /api/vessels?format=page&q=&status=&type=&stationId=&page=1 (omit unused filters).
GET /api/vessels/:id/history?page=1, /linked, /qr.
POST /api/vessels/:id/qr/replace and /revoke with reason.
POST /api/qr/resolve with payload. Authentication and scope required.
Existing create/update API retained. New runtime grants only QR lifecycle and read-only columns necessary for linked summaries; no future operational mutations.

## Run
Use existing Phase 1.4 Docker setup and MFA provisioning. Rebuild API and migration containers before opening /workspace/. Three themes retained; original dist/ demo unchanged. Smartphone camera needs HTTPS and approved network access; local loopback HTTP demo is for same computer only. Use uploaded PNG/JPEG (processed in browser only) or manual lookup if camera unavailable. No external scanner CDN. Review dependency lockfile and audit before release.

## Verification and limits
New integration checks cover filters, pagination, snapshots, scope, QR generation/resolve/replacement/revocation, inactive/reactivation, denial of future operational writes and local decoder asset. Phase 2 CI must be checked for its own commit. Browser visual rendering, printed labels, device camera compatibility, HTTPS deployment, load and independent security review are pending. No official PCG data, live SMS, enforcement, legal clearance, inspection/document editing, backup or offline sync enabled. Public repo uses synthetic fixtures only.
