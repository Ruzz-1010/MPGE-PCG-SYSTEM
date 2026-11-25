# Phase 1.4 — MFA and connected browser workspace

## Verified prior baseline
[Phase 1.3 CI run 45642398631](https://github.com/Ruzz-1010/MPGE-PCG-SYSTEM/actions/runs/45642398631) completed successfully for 95682767c9e286e126f6b6100f5e31002ba9df03. Actual logs: two unit and five integration groups passed, zero failures or skips. No baseline failure required correction.

## New implementation
- Migration 004 adds two nullable MFA fields (36 tables, 266 fields), invalidates existing sessions. Regional, Station and IT administrators require a provisioned TOTP secret and fresh valid code for both API and browser login. Nonprivileged accounts keep password login. Secrets are encrypted with AES-256-GCM and associated with account ID; last accepted step is transactionally checked/updated. A 30-second, six-digit SHA-1 TOTP with ±1 step tolerance is used. The existing failed-login throttle also covers wrong/missing OTP. No password-only self-enrollment or remote MFA reset.
- Same-origin browser login issues an HttpOnly, SameSite=Strict, path=/ cookie; default deployment uses Secure __Host- cookie, HTTPS and exact origin checks on mutations. Loopback demo explicitly uses HTTP and a different cookie name; never expose this configuration externally. Browser receives no bearer token. Existing bearer API remains available for authorized API clients, with same MFA gate. No credentials stored in localStorage; only theme choice.
- New backend-served /workspace/ uses actual API data, three themes and server-provided role capabilities. Read-only views of registry, accounts and audit where authorized; no fake metrics, role picker or operational actions. Dashboard counts are server-scoped, not hardcoded. Original dist/ demo untouched. Registry forms and pagination UI pending.
- New unit and integration tests authored; Phase 1.4 CI result must be checked separately.

## Local demo instructions
Use previous Docker setup from backend/. Add a third environment value VW_MFA_KEY to .env.compose: separate random 64-character hex (openssl rand -hex 32). Keep it secure, persistent and backed up separately from the DB. Key loss requires verified re-provisioning of all privileged accounts. No actual credentials in Git. Rebuild containers and run migration/grants before launch.
1. docker compose --env-file .env.compose up --build -d api
2. For an empty database, bootstrap the initial fictional regional account using the existing command (see PHASE_1_2.md).
3. Load the MFA key securely into your local shell as VW_MFA_KEY (same value used by Compose). Set MFA_USERNAME to the account username. In a private interactive terminal, run:
   docker compose --env-file .env.compose run --rm -e VW_MFA_KEY -e MFA_USERNAME migrate npm run mfa:provision
   Do not redirect or capture the setup output. Add the printed Base32 setup key manually to a trusted authenticator app with 6 digits, time-based SHA-1, 30-second steps. Do not put the key in screenshots, GitHub or chat.
4. Open http://127.0.0.1:3000/workspace/ in the same local browser. Login with account password and fresh authenticator code if privileged. If temporary password requires change, sign in again using a new code.
5. Other privileged accounts must be provisioned separately by an authorized local operator. Verified local recovery: use the same provisioning command with MFA_REPLACE=confirmed provided only after identity and authority verification; it replaces the seed and revokes sessions. No remote self-service recovery. The local operator must record identity verification separately; the audit event does not establish identity of the OS operator.

## Remaining gates
Run Phase 1.4 CI and review actual logs. Manual browser desktop/mobile, keyboard/accessibility, production TLS proxy, independent security audit, secure key management/recovery policy, phishing-resistant MFA option, dependency lock and vulnerability review, session cleanup, operational account provisioning UX and all other V2 feature APIs are still pending. This is a student prototype with synthetic records only. Do not expose the loopback demo, add actual PCG data or merge main until reviewed. Browser test checks HTTP cookie behavior and endpoint responses, not visual rendering or real HTTPS cookie delivery.
