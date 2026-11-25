# MPGE PCG SYSTEM

## MEPG VesselWatch Draft

Interactive thesis prototype for **MEPG VesselWatch: An Integrated Centralized Vessel Monitoring and Document Management System for the Marine Environmental Protection Group – Palawan**.

This static draft demonstrates a centralized vessel-record dashboard for nine stations. It uses sample data only and is not connected to real PCG/MEPG records.

## Current Features

- Practical role-and-station entry screen
- Role-aware workspaces for Regional Admin, Station Admin, Inspector Personnel, Records Officer, and IT System Administrator
- Dashboard with station-scoped metrics, recent activity, and work queue
- Vessel Registry with authorized records, filters, status, and registration draft form
- Inspection Management with Draft, Submitted, Reviewed, and Returned workflow states
- Document Management with verification and expiration status
- Loading/Unloading and Bunkering operation records linked to vessel profiles
- Notifications, Station Management, Reports, Audit Trail, Backup & Recovery, and User Management screens
- Responsive desktop and mobile application shell

## Project Structure

```text
dist/
  index.html                 Main user interface
  assets/
    css/
      base.css               Core dashboard layout and visual styles
      roles.css              Role-entry screen and role-specific styles
    js/
      app.js                 Dashboard behavior and demo permission logic
docs/
  ROLE_BASED_ACCESS.md       Proposed access-control rules
```

## Run Locally

Open `dist/index.html` in a modern web browser.

## Important Implementation Note

The current role switcher is a **frontend demonstration only**. In the production system, permissions must be enforced by the backend API and PostgreSQL database; hiding a button in the browser is not security.

## Next Build Steps

1. Replace sample data and local prototype actions with a Node.js/Express API.
2. Implement PostgreSQL tables, constraints, station memberships, workflow history, and audit events.
3. Add secure authentication, sessions, password hashing, MFA for privileged users, and backend-enforced access control.
4. Add private validated storage for documents, photos, and inspection evidence.
5. Implement persistence, version history, exports, notification delivery, and tested backup/restore procedures.

## Phase 1.2 development branch

See [Phase 1.2 setup and test gates](docs/PHASE_1_2.md), [database ERD](docs/ERD_V2.md), [data dictionary](docs/DATA_DICTIONARY_V2.md) and [verification record](docs/PHASE_1_2_TEST_RESULTS.md). The existing dist/ interface remains a static demo. The backend and Docker configuration are separate, local-only development components.
