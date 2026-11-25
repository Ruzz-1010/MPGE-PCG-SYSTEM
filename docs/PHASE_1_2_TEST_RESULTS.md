# Phase 1.2 verification record

## Executed in the current environment

- Node v22.16.0; original policy.js, passwords.js and foundation.test.js were reconstructed byte-for-byte from the GitHub blobs, then their Git blob SHA-1 hashes were verified:
  - policy.js: 5e1d779c60523eda098ba9a7da0bd1461ae5f250
  - passwords.js: 2a7691d5328736f6bf89912f002d3d3d03c94d08
  - foundation.test.js: 500a1123cd5f247d2133fea7c40d774d1673aef4
- Executed node --test on those verified source files. Actual TAP results: 2 tests, 2 pass, 0 fail, 0 skipped, 0 cancelled.
  - PASS station and role restrictions
  - PASS password hashing and opaque token handling
- Static inspection of the new Git tree: 36 unique table names; every referenced table exists; all 36 listed in dictionary and ERD; original migration 001 and runtime grant file unchanged; three simulation-only CHECK gates; only demo SMS channel. These checks are text/structure checks, not SQL execution.

## Not executed

No PostgreSQL server, Docker binary, or working external package network was available locally. No migration execution, Compose build/start, actual API integration pass, live SMS, browser integration, actual backup/restore, load test, or security audit is claimed. The integration test script is authored and must be run against a fresh disposable Compose project. See PHASE_1_2.md. Do not merge to main or deploy operational data until verification gates are met.
