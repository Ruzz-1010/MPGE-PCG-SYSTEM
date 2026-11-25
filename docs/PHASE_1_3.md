# Phase 1.3 hardening

Baseline verification: [GitHub Actions run 45641808377](https://github.com/Ruzz-1010/MPGE-PCG-SYSTEM/actions/runs/45641808377), head 4e6764d6e0d1090f16a13dcf67f34987ebc2ab6b, completed successfully. Job logs report 2/2 unit tests and 3/3 PostgreSQL/API integration groups passed; no skipped/failed tests. Docker DB and API health checks and cleanup succeeded. No baseline failure was found.

## Changes
- Additive migration 003; original migrations untouched. Adds three security fields (36 tables, 264 fields), invalidates pre-003 sessions once.
- Account-specific temporary throttle: five failed sign-ins trigger a 15-minute lock; successful login/password reset clears the counter. Generic 401 for invalid/disabled/locked credentials. IP limit 30 attempts/15 min; password change limit separate 12/15 min. These thresholds are proposed demo defaults, not approved policies. Account locking can be abused for denial of service; monitor and review before production.
- 30-minute idle expiry, 8-hour absolute expiry, at most five active sessions per account. Password change/reset and deactivation already revoke sessions. Tokens remain hashed server-side; no browser integration yet.
- Inactive assigned station blocks login and authenticated actions; observed inactive station invalidates that user's sessions. No station lifecycle API yet; reactivation without an intervening request is not a global session revocation mechanism.
- Reject unexpected JSON write fields, invalid control characters in text, invalid page queries; no privilege/actor/station mass assignment.
- Database startup refuses unexpected runtime role, superuser, owner membership, bypass-RLS, CREATE ROLE/DB privileges. Column-level UPDATE restrictions prohibit changes to user role/assignment and vessel station/creator using runtime grants. Application authorization remains the primary row-scope control (no RLS yet).
- Concurrent transaction conflicts return generic HTTP 409, not internal SQL detail.
- Additional integration groups cover the above; no actual clearance, watchlist, signature or SMS features are enabled.

## Verification
Baseline run above is verified. New commit must be evaluated by its own CI run. Test counts from the prior run do not prove this revision works. No production deployment or real data. Main remains unchanged.

## Remaining security gates
Privileged MFA and recovery, session handling in browser (prefer secure HttpOnly cookies with CSRF protection), HTTPS/proxy configuration, centralized distributed throttling, account/station lifecycle and audit review, RLS/defense in depth, dependency locking/scanning, load testing, independent security review and actual backup/restore remain pending. No public operational exposure. Real agency data and approval-dependent operations are out of scope for this prototype.
