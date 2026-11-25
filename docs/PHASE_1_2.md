# Phase 1.2 — V2.0 database design and integration environment

## Baseline and scope
Requirements Analysis V2.0 (25 November 2026), especially sections 6–9 and 12, is the source of this draft. All 13 groups have database structures. That does not mean all 13 modules are implemented: the current API still covers named accounts, registry and audit only. The separate original dist/ UI remains a static demonstration. The extra Operations module has not been accepted into the 13-feature baseline. Main is not modified.

- 001 remains immutable. 002 adds 30 tables (36 total) for QR, versioned inspections/checklists, attestations, demo clearance, documents and verification, private file metadata, contact/notifications, sync keys/conflicts, monthly reports, violations and demo list review, backup/restore metadata, announcements and messages.
- See [ERD](ERD_V2.md) and [data dictionary](DATA_DICTIONARY_V2.md). No runtime grants for new tables; grants for foundation only. All business actions remain subject to server-side scoped authorization and transaction design in later phases.
- Scope is record-based. No GPS/AIS. No real owner contacts, agency records or credentials in this public repository.
- Decisions pending PCG approval remain simulation-only by schema constraints and/or absent APIs. No official clearance or automatic Hold, real SMS, legal digital signatures, automatic watchlisting or penalty actions.
- Record ownership remains station-scoped for the implemented registry. Cross-station inspection history requires a separate approved access policy; do not broaden registry permissions silently.
- Schema supports state/history but future APIs must enforce exact transitions, reviewed-record immutability, sequential versioning, verified recipient links, approved templates, idempotent payload matching, offline cache removal, file content validation, count semantics and scoped audience access. DDL alone does not enforce those workflows.
- Backup tables store metadata only; there is no scheduled backup or tested restore implementation. Test suite checks metadata constraints, not actual file recovery.
- File size limit 20 MiB, accepted metadata types PDF/JPEG/PNG, report date/threshold assumptions and form field names are proposed. No agency approval assumed. Future grants should be reviewed individually.

## Development environment (disposable, local only)
Prerequisites Docker Engine/Desktop with Compose v2; internet for initial image and package downloads. Compose database owner is the official PostgreSQL image's local initialization superuser; runtime is a separate non-superuser. Do not use this setup as production. No DB host port; API only on 127.0.0.1. No production TLS/MFA here. Do not bind to the internet.

From backend/:
1. Copy compose.env.example to .env.compose (ignored by Git). Generate two different 48-character hex strings using Node: node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))". Put one into each variable. Never commit the values. Use new empty volumes when changing initialization passwords.
2. docker compose --env-file .env.compose up --build -d api
3. docker compose --env-file .env.compose logs migrate
4. GET http://127.0.0.1:3000/api/health. The migration job applies 001 and 002, re-runs the migration runner to check idempotency, then applies runtime grants.
5. To create an initial demo account without the test fixtures, run the existing bootstrap command in the migration service with BOOTSTRAP_USERNAME, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD supplied through your local environment (not committed). Example: docker compose --env-file .env.compose run --rm -e BOOTSTRAP_USERNAME -e BOOTSTRAP_NAME -e BOOTSTRAP_PASSWORD migrate npm run bootstrap. Do not use a real PCG name.
6. Run integration tests in a **fresh disposable Compose project**. Example: docker compose -p vw-test --env-file .env.compose --profile test up -d --build api ; docker compose -p vw-test --env-file .env.compose --profile test run --rm test ; docker compose -p vw-test --env-file .env.compose --profile test down -v. Stop other local API instances first (same host port). The test environment creates synthetic account/registry fixtures; feature constraint fixtures are rolled back. The last command destroys only the disposable project's volumes. Never run it against a project containing records to retain.
7. npm test runs original unit tests; integration/phase12.integration.js checks actual migration state, scoped API, revision history, session revocation, runtime grants, and selected new constraints. The schema owner is used only for fixture setup and invariant checks, not API requests. Tests are not a complete security assessment.

Docker base image tags and npm dependencies are not yet locked to immutable digests/lockfile; obtain and review dependency lockfile and scans in a network-enabled environment before release.

## Coverage by V2 feature group
| Group | Schema | Integration gate in this change | Still required |
|---|---|---|---|
| 01 | vessels, vessel_versions | registry, duplicate, version checks | linked history and UI |
| 02 | qr_identifiers | active QR uniqueness | scanning/revocation API |
| 03 | templates, items, inspections, versions, answers, attestations, clearance | template FK and simulation constraints | autosave, review workflow, gated demo |
| 04 | document_types, documents, versions, reviews | date consistency | expiry job, renewal API |
| 05 | contacts, notifications, attempts | dedup, channel/recipient shape | daily alert scheduler, SMS simulation |
| 06 | sync_requests, sync_conflicts | retry-key uniqueness | IndexedDB/PWA, sync engine |
| 07 | private_files, evidence_links | type and link constraints | validated private upload/storage |
| 08 | monthly_reports | month boundary | counts/export |
| 09 | violations, revisions, list_reviews | simulation gate | approved review workflow |
| 10 | users, stations, sessions | scope, password change, deactivation, logout | MFA, account lifecycle policy |
| 11 | audit_events, history | audit records and restricted updates | complete module coverage |
| 12 | backup_runs, restore_tests | success metadata constraints | real backup and independent restore |
| 13 | announcements, audience, receipts, messages | publish state and unique recipient | scoped inbox/publish APIs |

## Test status
The current development environment lacks Docker, PostgreSQL binaries, and network access for npm dependencies. Full Compose/integration execution must occur in a supported environment or CI. No database migration, actual backup, or full integration pass is claimed merely from writing tests. Keep this record updated with actual logs when available.
