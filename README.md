# MPGE PCG SYSTEM

## MEPG VesselWatch Draft

Interactive thesis prototype for **MEPG VesselWatch: An Integrated Centralized Vessel Monitoring and Document Management System for the Marine Environmental Protection Group – Palawan**.

This static draft demonstrates a centralized vessel-record dashboard for nine stations. It uses sample data only and is not connected to real PCG/MEPG records.

## Current Features

- Role-and-station entry screen
- Role-based dashboard demo for Regional Admin, Station Admin, Inspector Personnel, and Records Officer
- Station-scoped vessel lookup simulation
- Vessel dashboard metrics, activity log, document alerts, and station synchronization view
- Inspection-draft modal
- Responsive desktop and mobile layout

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

1. Replace sample data with a Node.js/Express API.
2. Implement PostgreSQL tables, station memberships, and audit events.
3. Add secure authentication and server-enforced role-based access control.
4. Add private cloud storage for photos and PDFs.
5. Add actual account administration and inspection workflows.
