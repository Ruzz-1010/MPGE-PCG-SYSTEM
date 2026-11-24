# MEPG VesselWatch Project Plan

## Project status

**Proposed title:** MEPG VesselWatch: An Integrated Centralized Vessel Monitoring and Document Management System for the Marine Environmental Protection Group – Palawan

**Status:** Thesis prototype and requirements baseline. All agency workflows, data fields, roles, hosting, retention rules, and security controls require validation and approval from authorized PCG-MEPG and IT personnel.

## Project definition

VesselWatch is a proposed centralized, web-based information system for authorized personnel across nine participating Palawan stations, subject to official confirmation. It centralizes vessel records, inspection history, documents, evidence, station-based permissions, reports, audit logs, backups, and recovery records.

Monitoring is **record-based**. This project does not include real-time GPS/AIS tracking, satellite monitoring, public tracking, automatic legal clearance, or automatic enforcement decisions.

## Core scope

The system baseline has ten connected modules:

1. Authentication and User Management
2. Dashboard
3. Vessel Registry
4. Inspection Management
5. Document Management
6. Notification Management
7. Station Management
8. Reports and Analytics
9. Audit Trail
10. Backup and Recovery

Loading/Unloading and Bunkering records are proposed vessel-related operation records. They must remain associated with a vessel profile and must not replace the core Vessel Registry, Inspection Management, or Document Management modules without stakeholder validation.

## Access model

| Role | Proposed responsibility |
|---|---|
| Regional Admin | Authorized cross-station records, reports, accounts, and audit oversight |
| Station Admin | Station accounts, station submissions, and station review |
| Inspector Personnel | Authorized search, inspection drafts, and approved evidence upload |
| Records Officer | Document validity/completeness review and authorized station reports |
| IT System Administrator | Proposed technical role for application, database, backup, and security maintenance |

Every user must have an individual account, role, active status, and station membership. Role and station permissions must be enforced by the backend API and PostgreSQL database—not only by hiding dashboard controls.

## Proposed technical design

| Component | Proposed technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js / Express.js |
| Database | PostgreSQL |
| Operating system | Ubuntu Server |
| Reverse proxy | Nginx |
| Deployment | Docker |
| File storage | Private storage with validated uploads |
| Version control | Git / GitHub |
| API testing | Postman |
| Network security | HTTPS / TLS |

PostgreSQL stores structured records, metadata, audit entries, status history, and private file references. Documents, photos, and inspection evidence must use private storage; access must be restricted and validated.

## Thesis deployment plan: one Mini PC

The thesis deployment follows the current requirements baseline: one Mini PC hosts the web application, API, PostgreSQL database, and private local file storage. It is for development, demonstration, evaluation, and mock or approved sanitized data only.

```text
Authorized thesis clients
      ↓ secure network access
Mini PC: web application + API + PostgreSQL + private file storage
      ↓ encrypted backup
Independent off-site cloud backup
```

| Component | Thesis recommendation | Purpose |
|---|---|---|
| Mini PC server | Modern four-core processor or equivalent | Runs the thesis system |
| RAM | 16 GB | Supports application, database, and test workload |
| Storage | 1 TB SSD | OS, database, documents, evidence, and recovery data |
| Power | UPS | Reduces interruption risk during power loss |
| Off-site backup | Encrypted cloud backup | Independent recoverable copy |

Ubuntu Server, PostgreSQL, Docker, Nginx, and Let’s Encrypt can be used without software license fees. Expected costs are hardware, UPS, electricity, internet, optional domain, encrypted backup storage, setup, and maintenance.

> A single Mini PC is a single point of failure. Backup supports restoration but does not prevent downtime. This limitation must be stated in the thesis evaluation.

## Future operational deployment

Operational adoption requires PCG-MEPG and PCG IT approval. At that stage, use an approved managed-cloud or on-premises architecture with redundancy, including multiple application servers, a PostgreSQL primary/standby setup, private object storage, and an independent backup copy.

```text
9 MEPG Stations → HTTPS/VPN → Load balancer → Multiple application servers
                                         ↓
                           PostgreSQL primary + standby database
                                         ↓
                    Private object storage + independent backup copy
```

Operational provider, region, data residency, SLA, retention, budget, and failover targets must be confirmed before procurement.

## Storage and backup

| Storage type | Initial thesis plan | What it holds |
|---|---:|---|
| Mini PC SSD | 1 TB | OS, application, PostgreSQL, approved files, and local recovery data |
| PostgreSQL data | Portion of Mini PC SSD | Structured records, indexes, audit logs, and file metadata |
| Private local storage | Portion of Mini PC SSD | Documents, photos, and inspection evidence |
| Encrypted off-site backup | Sized after pilot measurement | Independent database and file recovery copy |

Measure actual photo/PDF volume, file size, upload frequency, retention period, and expected users during the pilot before operational procurement.

## Backup and recovery policy

1. Run automated PostgreSQL backups at least daily.
2. Back up approved documents and evidence at least daily.
3. Encrypt the off-site backup copy and restrict it to authorized technical personnel.
4. Record each backup success or failure.
5. Test restoration using non-production or approved test data.
6. Record recovery results against the proposed RPO of 24 hours and RTO of 4 hours.
7. Maintain protected backup and audit records.

## Security requirements

- Require named user accounts, strong password hashing, secure logout, and session management.
- Use MFA for privileged accounts when implemented.
- Enforce role- and station-based authorization on every backend request.
- Use HTTPS/TLS and encrypted backups.
- Restrict document access, validate file type and size, and retain document version history.
- Record material actions with actor, action, resource, timestamp, and station context.
- Keep audit logs protected from ordinary-user modification.
- Use only mock or approved sanitized data during thesis development.
- Obtain PCG-MEPG approval before storing real vessel, owner, or inspection data.

## Initial performance targets for thesis evaluation

| Requirement | Proposed target |
|---|---|
| Typical vessel search | Within 2 seconds under agreed test workload |
| Common page response | Within 3 seconds under defined network conditions |
| Initial concurrent test load | 30 simultaneous users |
| Recovery-point objective | Maximum 24-hour data-loss gap |
| Recovery-time objective | Restoration within 4 hours in a defined test |

These are proposed evaluation targets, not guaranteed production capabilities.

## Next validation questions

1. What are the official nine participating stations and designated system owner?
2. What exact vessel, inspection, and document fields are mandatory?
3. What are the approved document types, renewal rules, and expiry thresholds?
4. What is the actual inspection review workflow?
5. How many users, inspections, photos, and PDFs are expected per station?
6. What backup frequency, retention period, RPO, and RTO does PCG require?
7. Is access through VPN, public HTTPS with secure login, or another approved network model?
8. Will PCG IT host and maintain the Mini PC, UPS, network, firewall, backups, and recovery process after turnover?

## Immediate development priority

Obtain blank or approved sanitized vessel forms, inspection checklists, documents, logbooks, and spreadsheets before finalizing the ERD, database schema, and SRS. Build the Vessel Registry and Inspection Management modules first, then documents, alerts, reporting, audit logs, and backup/recovery testing.
