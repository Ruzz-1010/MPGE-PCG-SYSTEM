# Phase 1 — database and API foundation (V2.0)
Working thesis prototype; public repository. Synthetic data only. Main branch remains unchanged.

## Repository review
The existing dist/ app is a static role-switching demonstration with sample arrays, not authentication or data persistence. Preserve it; do not connect real records to it. Its extra loading/unloading/bunkering Operations screen is not a confirmed part of the updated 13-feature baseline. Three-theme UI integration belongs to the next stage.

## Proposed database relationships
- stations 1:N users (station roles), vessels
- users 1:N sessions, vessel creation/modification, audit events
- vessels 1:N vessel_versions (immutable to runtime role)
- audit events reference actor and station when known.
- Regional and technical accounts have no station assignment; station/inspector/records accounts require one.
- Internal ID is generated from the UUID, distinct from official registration. Normalized official registration unique; same normalized name or registration triggers manual review (no override UI in Phase 1).
- Owner/operator is a text candidate field; collect only approved data later. No physical deletion API.
- Nine fictional station rows. Actual station directory, types, registration uniqueness convention and duplicate resolution procedure require validation.

## Requirement mapping
| V2 requirement | Phase 1 state |
| --- | --- |
| FR-01.01–03, 05–06 | Registry create/read/search/update, unique ID, basic duplicate prevention and version checks implemented in API; untested against PostgreSQL |
| FR-01.04, 07 | Linked documents/inspections and archival policy pending; inactive profile status only |
| FR-10.01–06, 08 | Named accounts, session handling, scoped role policy, create/deactivate/reset accounts, password change; partial implementation (no station admin setup UI, no inspector inspection API, no role reassignment yet) |
| FR-10.07 | Privileged MFA pending; mandatory before operational use |
| FR-11.01–03, 05–06 | Audit for implemented API actions; append-only grants, regional read; filtering and full audit coverage pending |
| FR-11.04 | Other feature histories pending |
| FR-02–09, FR-12–13 | Later migrations and modules: QR, inspections and simulated clearance, documents, reminders/SMS, offline, photos, reports, list reviews, backup, communication |

No GPS/AIS or automatic enforcement. Official clearance, automatic Hold, blacklist decision, digital signature and real SMS are not implemented.

## Proposed future data dictionary
Add versioned checklist templates/items, inspections and inspection versions; clearance decision history (separate from internal review); documents and immutable document versions; private evidence file metadata; QR identifier lifecycle; notification/outbox and delivery attempts; offline idempotency keys and conflict records; violations and reviewed list entries; report run metadata; backup/restore events; announcements and audience mappings. Define keys, constraints and permissions in later migrations after agency validation. Do not infer official procedures.

## Local setup (Node 22+, PostgreSQL 16+)
1. Create a local demo database named vesselwatch and a non-superuser owner/migration login. Create a distinct LOGIN role named vesselwatch_app (not a member of owner role), using a locally chosen password. Use psql's password prompt or approved secret manager; never commit credentials. Grant database CONNECT to runtime role. Run the migration as the owner.
2. cd backend; copy .env.example to .env. Fill DATABASE_URL with runtime role connection string and MIGRATION_DATABASE_URL with owner connection string (URL-encode credentials). Use local demo database only.
3. npm install (lockfile not yet generated); npm run migrate.
4. Execute migrations/runtime-grants.sql with psql as owner. Example: psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/runtime-grants.sql (set the URL securely in your local shell).
5. Set BOOTSTRAP_USERNAME, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD (14+ chars) for a fictional regional account. npm run bootstrap. Remove bootstrap password and owner connection from the API runtime environment; keep owner credentials in a separate local migration configuration. Do not start the API as the database owner.
6. npm test; npm start. Default bind is 127.0.0.1:3000. GET /api/health checks database connectivity. Use a local API client; the original dist/ frontend remains a separate demo and is NOT connected.
7. POST /api/auth/login with username/password, keep returned bearer token in memory, send Authorization: Bearer TOKEN on protected calls. Do not paste token into screenshots or logs. Use HTTPS behind a correctly configured trusted proxy before network access.

## API reference
- POST /api/auth/login, logout, change-password; GET /api/auth/me.
- GET /api/stations, /api/users?page=1, /api/vessels?q=...&stationId=...&page=1, /api/vessels/:uuid, /api/audit?page=1.
- POST /api/users: username, fullName, role, stationId (station roles), password. First sign-in requires password change. Regional creates regional/station/inspector/records; station admin creates inspector/records in own station. Technical account provisioning pending.
- PATCH /api/users/:uuid: active boolean and/or resetPassword; revokes sessions. Self-management via this route denied. Change-password requires currentPassword/newPassword, revokes all sessions.
- POST /api/vessels: name, officialRegistration, ownerOperator, vesselType; optional stationId must match account.
- PUT /api/vessels/:uuid: same four fields plus current version and profileStatus (active/inactive). No station reassignment or deletion.
- Successful writes and history/audit insert are transactional. List endpoints return up to 50 rows; no total count yet.

## Verification gates before merge
Run npm test, npm run migrate twice, test bootstrap, then exercise API against disposable PostgreSQL: invalid login, initial password change, expired session, disabled user, inspector write denial, cross-station direct ID access denial, regional read, station admin privilege escalation denial, technical operational denial, duplicate registration/name, stale version, audit/history preservation and runtime rejection of audit UPDATE/DELETE. Test concurrent updates and transaction rollback. Measure performance separately. No database integration, browser or security testing has been executed in this change. Do not deploy publicly. Rate limiting is process-local; MFA, TLS deployment, data retention, session cleanup, production threat review, actual backups and all later modules remain pending. No automated cloud backup or recovery claim.
