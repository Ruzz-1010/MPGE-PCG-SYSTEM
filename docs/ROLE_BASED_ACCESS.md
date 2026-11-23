# Role Based Access Model

## Regional Admin

- Views authorized records and reports across all nine stations.
- Manages stations and regional-level user access.
- Reviews audit activity and system-level alerts.
- Does not automatically receive authority to issue legal clearance or change an approved inspection without the documented agency workflow.

## Station Admin

- Is assigned to one station.
- Manages authorized personnel accounts within that station.
- Reviews station submissions, document alerts, and inspection drafts.
- Views only records permitted by the station and regional policy.

## Inspector Personnel

- Searches authorized vessel records in the assigned station scope.
- Creates inspection drafts and uploads approved evidence.
- Cannot silently alter approved historical inspections or grant formal clearance.

## Records Officer

- Reviews documents, expiry dates, verification status, and record completeness.
- Produces authorized station reports.
- Does not manage users or issue official enforcement decisions.

## Enforcement Requirement

Every account must have a unique user ID, role, active status, and station membership. The backend must enforce role and station checks for every API request. Material record actions must create an audit event containing the actor, action, resource, timestamp, and station context.
