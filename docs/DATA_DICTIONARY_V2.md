# MEPG VesselWatch — data dictionary V2.0

Draft schema for synthetic thesis data; approval-dependent features remain simulated. The SQL migrations are authoritative for exact types and constraints. This register includes every column of 36 tables (excluding migration bookkeeping). Nullable unless NOT NULL or primary key. No future-module runtime grants until API authorization is implemented.

## stations — Participating station directory (nine synthetic rows initially)

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Primary internal identifier |
| `code` | `text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{2,20}$')` | Station code |
| `name` | `text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120)` | Display name |
| `active` | `boolean NOT NULL DEFAULT true` | Enabled state |

Table rules:
- All column constraints listed above; see index register below.


## users — Named account; role and scope; credential material restricted

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Primary internal identifier |
| `username` | `text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,64}$')` | Unique login |
| `full_name` | `text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120)` | Account display name |
| `password_hash` | `text NOT NULL` | Restricted password verifier |
| `role` | `text NOT NULL CHECK (role IN ('regional','station','inspector','records','technical'))` | Assigned role |
| `station_id` | `uuid REFERENCES vw.stations(id) ON DELETE RESTRICT` | Assigned/responsible station |
| `active` | `boolean NOT NULL DEFAULT true` | Enabled state |
| `must_change_password` | `boolean NOT NULL DEFAULT true` | Initial/reset password gate |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Creation time |

Table rules:
- `CHECK ((role IN ('regional','technical') AND station_id IS NULL) OR (role IN ('station','inspector','records') AND station_id IS NOT NULL))`


## sessions — Hashed opaque token and expiration

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `token_hash` | `text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$')` | Restricted hashed bearer token |
| `user_id` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE CASCADE` | Account reference |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Creation time |
| `expires_at` | `timestamptz NOT NULL` | Session expiry |

Table rules:
- All column constraints listed above; see index register below.


## vessels — Central registry

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Primary internal identifier |
| `internal_id` | `text GENERATED ALWAYS AS ('VW-' \|\| upper(id::text)) STORED UNIQUE` | Generated VesselWatch identifier |
| `name` | `text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 180)` | Display name |
| `official_registration` | `text NOT NULL CHECK (length(btrim(official_registration)) BETWEEN 1 AND 100)` | Recorded registration |
| `owner_operator` | `text NOT NULL CHECK (length(btrim(owner_operator)) BETWEEN 1 AND 180)` | Restricted recorded owner/operator |
| `vessel_type` | `text NOT NULL CHECK (length(btrim(vessel_type)) BETWEEN 1 AND 100)` | Vessel classification |
| `station_id` | `uuid NOT NULL REFERENCES vw.stations(id) ON DELETE RESTRICT` | Assigned/responsible station |
| `profile_status` | `text NOT NULL DEFAULT 'active' CHECK (profile_status IN ('active','inactive'))` | Registry state |
| `version` | `integer NOT NULL DEFAULT 1 CHECK (version > 0)` | Revision sequence |
| `created_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Creating account |
| `updated_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Updating account |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Creation time |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Modification time |

Table rules:
- All column constraints listed above; see index register below.


## vessel_versions — Historical snapshots

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `vessel_id` | `uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT` | Vessel reference |
| `version` | `integer NOT NULL` | Revision sequence |
| `snapshot` | `jsonb NOT NULL` | Historical record snapshot |
| `changed_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Revision actor |
| `recorded_at` | `timestamptz NOT NULL DEFAULT now()` | Server event time |

Table rules:
- `PRIMARY KEY(vessel_id,version)`


## audit_events — Append-only accountability events

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | Primary internal identifier |
| `actor_id` | `uuid REFERENCES vw.users(id) ON DELETE RESTRICT` | Account responsible, if known |
| `station_id` | `uuid REFERENCES vw.stations(id) ON DELETE RESTRICT` | Assigned/responsible station |
| `action` | `text NOT NULL` | Action label |
| `resource_type` | `text NOT NULL` | Affected resource category |
| `resource_id` | `text` | Affected resource reference |
| `outcome` | `text NOT NULL CHECK (outcome IN ('success','denied','failure'))` | Event outcome |
| `detail` | `jsonb NOT NULL DEFAULT '{}'::jsonb` | Sanitized event metadata |
| `recorded_at` | `timestamptz NOT NULL DEFAULT now()` | Server event time |

Table rules:
- All column constraints listed above; see index register below.


## qr_identifiers — Opaque QR lifecycle; no personal data embedded.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `vessel_id` | `uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT` | Vessel linked to QR |
| `token` | `uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()` | Opaque QR reference |
| `issued_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Issuing account |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |
| `revoked_at` | `timestamptz` | Revocation time |
| `revoked_by` | `uuid REFERENCES vw.users(id) ON DELETE RESTRICT` | Revoking account |

Table rules:
- `CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))`
- `CHECK (revoked_at IS NULL OR revoked_at >= created_at)`


## owner_contacts — Private, approved notification contacts; no live SMS.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `vessel_id` | `uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT` | Associated vessel |
| `phone_e164` | `text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')` | Restricted contact number |
| `verified_at` | `timestamptz` | Contact verification time |
| `sms_authorized` | `boolean NOT NULL DEFAULT false` | Recorded permission for SMS |
| `recorded_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Recording account |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(vessel_id,phone_e164)`
- `CHECK (NOT sms_authorized OR verified_at IS NOT NULL)`


## checklist_templates — Versioned candidate inspection forms.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `name` | `text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160)` | Form label |
| `version` | `integer NOT NULL CHECK (version>0)` | Template version |
| `active` | `boolean NOT NULL DEFAULT false` | Enabled for future use |
| `created_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Author |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(name,version)`


## checklist_items — Immutable candidate checklist questions.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `template_id` | `uuid NOT NULL REFERENCES vw.checklist_templates(id) ON DELETE RESTRICT` | Template version |
| `item_code` | `text NOT NULL` | Stable code within template |
| `prompt` | `text NOT NULL CHECK (length(btrim(prompt))>0)` | Question |
| `ordinal` | `integer NOT NULL CHECK (ordinal>0)` | Display order |
| `required` | `boolean NOT NULL DEFAULT true` | Required answer indicator |

Table rules:
- `UNIQUE(template_id,item_code)`
- `UNIQUE(template_id,ordinal)`
- `UNIQUE(id,template_id)`


## inspections — Stable inspection identity and responsibility; versions carry workflow.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `vessel_id` | `uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT` | Inspected vessel |
| `station_id` | `uuid NOT NULL REFERENCES vw.stations(id) ON DELETE RESTRICT` | Responsible station |
| `inspector_id` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Responsible inspector |
| `template_id` | `uuid NOT NULL REFERENCES vw.checklist_templates(id) ON DELETE RESTRICT` | Selected template version |
| `inspected_at` | `timestamptz NOT NULL` | Recorded inspection time |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(id,template_id)`
- `UNIQUE(id,vessel_id)`


## inspection_versions — Append-only draft, review and correction snapshots.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `inspection_id` | `uuid NOT NULL REFERENCES vw.inspections(id) ON DELETE RESTRICT` | Inspection identity |
| `template_id` | `uuid NOT NULL REFERENCES vw.checklist_templates(id) ON DELETE RESTRICT` | Template used |
| `version` | `integer NOT NULL CHECK (version>0)` | Revision sequence |
| `workflow_state` | `text NOT NULL CHECK (workflow_state IN ('draft','submitted','returned','reviewed'))` | Internal review state |
| `findings` | `text NOT NULL DEFAULT ''` | Observations |
| `change_reason` | `text` | Correction or review reason |
| `changed_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Revision author |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(inspection_id,version)`
- `UNIQUE(id,template_id)`
- `UNIQUE(id,inspection_id)`
- `FOREIGN KEY(inspection_id,template_id) REFERENCES vw.inspections(id,template_id)`
- `CHECK (workflow_state <> 'returned' OR length(btrim(coalesce(change_reason,'')))>0)`


## checklist_answers — One answer per item per inspection version.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `inspection_version_id` | `uuid NOT NULL REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT` | Inspection snapshot |
| `template_id` | `uuid NOT NULL REFERENCES vw.checklist_templates(id) ON DELETE RESTRICT` | Template scope |
| `item_id` | `uuid NOT NULL REFERENCES vw.checklist_items(id) ON DELETE RESTRICT` | Question |
| `answer` | `text NOT NULL CHECK (answer IN ('pass','fail','not_applicable','not_checked'))` | Candidate answer values |
| `remarks` | `text` | Supporting note |

Table rules:
- `PRIMARY KEY(inspection_version_id,item_id)`
- `FOREIGN KEY(inspection_version_id,template_id) REFERENCES vw.inspection_versions(id,template_id)`
- `FOREIGN KEY(item_id,template_id) REFERENCES vw.checklist_items(id,template_id)`


## inspection_attestations — Demo attestation records, not a cryptographic signature.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `inspection_version_id` | `uuid NOT NULL REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT` | Exact record version |
| `attested_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Attesting account |
| `statement` | `text NOT NULL CHECK (length(btrim(statement))>0)` | Mock acknowledgement text |
| `is_simulated` | `boolean NOT NULL DEFAULT true CHECK(is_simulated)` | Mandatory prototype gate |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(inspection_version_id,attested_by)`


## clearance_events — Separate append-only simulated clearance decisions; never official.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `inspection_version_id` | `uuid NOT NULL REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT` | Exact inspection version |
| `decided_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Demo decision actor |
| `status` | `text NOT NULL CHECK (status IN ('cleared','hold','withdrawn'))` | Simulated recorded decision |
| `reason` | `text NOT NULL CHECK (length(btrim(reason))>0)` | Reason |
| `is_simulated` | `boolean NOT NULL DEFAULT true CHECK(is_simulated)` | Cannot record official decision |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |



## document_types — Candidate document categories; not approved official checklist.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `code` | `text NOT NULL UNIQUE` | Internal category code |
| `name` | `text NOT NULL` | Label |
| `expiry_expected` | `boolean NOT NULL DEFAULT true` | Date expected by candidate type |
| `active` | `boolean NOT NULL DEFAULT true` | Category availability |



## documents — Stable document identity linked to vessel and category.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `vessel_id` | `uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT` | Document owner vessel |
| `type_id` | `uuid NOT NULL REFERENCES vw.document_types(id) ON DELETE RESTRICT` | Category |
| `required` | `boolean NOT NULL DEFAULT false` | Proposed required indicator, not legal determination |
| `created_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Record creator |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(id,vessel_id)`


## private_files — Private storage metadata only; no public URL.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `storage_key` | `uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()` | Opaque internal file storage key |
| `original_name` | `text NOT NULL CHECK (length(original_name) BETWEEN 1 AND 255)` | Original display name, untrusted |
| `media_type` | `text NOT NULL CHECK (media_type IN ('application/pdf','image/jpeg','image/png'))` | Candidate validated type |
| `byte_size` | `bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 20971520)` | Proposed limit 20 MiB |
| `sha256` | `text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$')` | Content integrity hash |
| `scan_state` | `text NOT NULL DEFAULT 'pending' CHECK (scan_state IN ('pending','accepted','rejected'))` | Validation state |
| `uploaded_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Uploader |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |



## document_versions — Versioned document metadata and scanned file.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `document_id` | `uuid NOT NULL REFERENCES vw.documents(id) ON DELETE RESTRICT` | Document identity |
| `version` | `integer NOT NULL CHECK(version>0)` | Renewal sequence |
| `number` | `text NOT NULL CHECK(length(btrim(number))>0)` | Recorded document number |
| `issuer` | `text NOT NULL CHECK(length(btrim(issuer))>0)` | Recorded issuing authority |
| `issue_date` | `date` | Recorded issue date |
| `expiry_date` | `date` | Recorded expiry date |
| `expiry_kind` | `text NOT NULL CHECK(expiry_kind IN ('dated','not_applicable','unknown'))` | Distinguishes absence from nonexpiring |
| `file_id` | `uuid REFERENCES vw.private_files(id) ON DELETE RESTRICT` | Private scanned document |
| `recorded_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Version author |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(document_id,version)`
- `CHECK ((expiry_kind='dated') = (expiry_date IS NOT NULL))`
- `CHECK (issue_date IS NULL OR expiry_date IS NULL OR expiry_date>=issue_date)`


## document_reviews — Append-only verification results, independent from date validity.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `document_version_id` | `uuid NOT NULL REFERENCES vw.document_versions(id) ON DELETE RESTRICT` | Version verified |
| `reviewed_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Reviewer |
| `status` | `text NOT NULL CHECK(status IN ('verified','rejected','needs_review'))` | Verification result |
| `reason` | `text` | Review note |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |



## evidence_links — Attach file to exactly one inspection or document version.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `file_id` | `uuid NOT NULL REFERENCES vw.private_files(id) ON DELETE RESTRICT` | Evidence file |
| `inspection_version_id` | `uuid REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT` | Inspection snapshot |
| `document_version_id` | `uuid REFERENCES vw.document_versions(id) ON DELETE RESTRICT` | Document snapshot |
| `attached_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Link author |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `CHECK (num_nonnulls(inspection_version_id,document_version_id)=1)`


## notifications — Deduplicated document-version alerts and simulated SMS.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `document_version_id` | `uuid NOT NULL REFERENCES vw.document_versions(id) ON DELETE RESTRICT` | Expiry event source |
| `threshold_days` | `integer NOT NULL CHECK(threshold_days IN (30,7,1,0,-1))` | 0 due today; -1 expired; others advance |
| `channel` | `text NOT NULL CHECK(channel IN ('dashboard','sms_demo'))` | Delivery medium |
| `recipient_user_id` | `uuid REFERENCES vw.users(id) ON DELETE RESTRICT` | Dashboard recipient |
| `recipient_contact_id` | `uuid REFERENCES vw.owner_contacts(id) ON DELETE RESTRICT` | Simulated SMS contact |
| `state` | `text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sent_demo','failed','acknowledged','cancelled'))` | Candidate delivery state |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |
| `acknowledged_at` | `timestamptz` | Acknowledgement time |
| `acknowledged_by` | `uuid REFERENCES vw.users(id) ON DELETE RESTRICT` | Acknowledging account |

Table rules:
- `CHECK ((channel='dashboard' AND recipient_user_id IS NOT NULL AND recipient_contact_id IS NULL) OR (channel='sms_demo' AND recipient_contact_id IS NOT NULL AND recipient_user_id IS NULL))`
- `CHECK ((acknowledged_at IS NULL)=(acknowledged_by IS NULL))`


## notification_attempts — Append-only simulated delivery and action history.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `notification_id` | `uuid NOT NULL REFERENCES vw.notifications(id) ON DELETE RESTRICT` | Source alert |
| `attempt_no` | `integer NOT NULL CHECK(attempt_no>0)` | Retry ordinal |
| `outcome` | `text NOT NULL CHECK(outcome IN ('sent_demo','failed','acknowledged','cancelled'))` | Attempt result |
| `detail` | `text` | Sanitized result or action note |
| `actor_id` | `uuid REFERENCES vw.users(id) ON DELETE RESTRICT` | Action actor |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(notification_id,attempt_no)`


## sync_requests — Stable idempotency keys and outcome; no unnecessary raw cached payload.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `actor_id` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Authenticated syncing account |
| `device_id` | `uuid NOT NULL` | Approved client identifier candidate |
| `client_request_id` | `uuid NOT NULL` | Stable retry key |
| `payload_sha256` | `text NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$')` | Canonical payload hash |
| `inspection_id` | `uuid REFERENCES vw.inspections(id) ON DELETE RESTRICT` | Resolved inspection |
| `base_version` | `integer CHECK(base_version>0)` | Expected server revision |
| `state` | `text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','committed','conflict','rejected'))` | Sync result |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |
| `resolved_at` | `timestamptz` | Terminal result time |

Table rules:
- `UNIQUE(actor_id,device_id,client_request_id)`
- `CHECK(state<>'committed' OR inspection_id IS NOT NULL)`


## sync_conflicts — Explicit conflict record without silent overwrite.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `sync_request_id` | `uuid NOT NULL REFERENCES vw.sync_requests(id) ON DELETE RESTRICT` | Conflicted request |
| `server_version_id` | `uuid REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT` | Conflicting version |
| `reason` | `text NOT NULL` | Conflict description |
| `resolution` | `text CHECK(resolution IN ('discard','resubmit','manual_merge'))` | Chosen resolution |
| `resolved_by` | `uuid REFERENCES vw.users(id) ON DELETE RESTRICT` | Authorized resolver |
| `resolved_at` | `timestamptz` | Resolution time |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(sync_request_id)`
- `CHECK ((resolved_at IS NULL AND resolution IS NULL AND resolved_by IS NULL) OR (resolved_at IS NOT NULL AND resolution IS NOT NULL AND resolved_by IS NOT NULL))`


## monthly_reports — Versionable report run metadata, not an approved counting policy.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `period_start` | `date NOT NULL CHECK(extract(day FROM period_start)=1)` | First day of reporting month |
| `station_id` | `uuid REFERENCES vw.stations(id) ON DELETE RESTRICT` | Null means consolidated |
| `generated_by` | `uuid REFERENCES vw.users(id) ON DELETE RESTRICT` | Generating account |
| `counting_rule` | `text NOT NULL` | Explicit candidate counting rule/version |
| `inspected_count` | `integer NOT NULL CHECK(inspected_count>=0)` | Report snapshot count |
| `cleared_count` | `integer NOT NULL CHECK(cleared_count>=0)` | Simulated cleared count |
| `held_count` | `integer NOT NULL CHECK(held_count>=0)` | Simulated held count |
| `pending_count` | `integer NOT NULL CHECK(pending_count>=0)` | Pending count |
| `state` | `text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','reviewed','submitted_demo'))` | Internal report state |
| `export_file_id` | `uuid REFERENCES vw.private_files(id) ON DELETE RESTRICT` | Private export |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |



## violations — Fictional recorded violation history, not automatic findings.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `vessel_id` | `uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT` | Associated vessel |
| `inspection_id` | `uuid REFERENCES vw.inspections(id) ON DELETE RESTRICT` | Source inspection |
| `recorded_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Recording officer |
| `occurred_at` | `timestamptz NOT NULL` | Recorded time |
| `violation_type` | `text NOT NULL` | Candidate classification |
| `recorded_penalty` | `text` | Recorded demo penalty |
| `action_taken` | `text` | Recorded action |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `UNIQUE(id,vessel_id)`
- `FOREIGN KEY(inspection_id,vessel_id) REFERENCES vw.inspections(id,vessel_id)`


## violation_revisions — Correction history for fictional violation records.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `violation_id` | `uuid NOT NULL REFERENCES vw.violations(id) ON DELETE RESTRICT` | Original record |
| `changed_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Correction actor |
| `reason` | `text NOT NULL CHECK(length(btrim(reason))>0)` | Explanation |
| `snapshot` | `jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object')` | Corrected candidate record |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |



## list_reviews — Review-only flags and simulated watchlist/blacklist history.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `vessel_id` | `uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT` | Flagged vessel |
| `source_violation_id` | `uuid REFERENCES vw.violations(id) ON DELETE RESTRICT` | Source record |
| `recorded_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Review actor |
| `kind` | `text NOT NULL CHECK(kind IN ('review_flag','watchlist_demo','blacklist_demo'))` | Demo classification |
| `state` | `text NOT NULL CHECK(state IN ('pending','active_demo','dismissed','closed'))` | Review status |
| `reason` | `text NOT NULL CHECK(length(btrim(reason))>0)` | Recorded reason |
| `is_simulated` | `boolean NOT NULL DEFAULT true CHECK(is_simulated)` | No official sanction |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `FOREIGN KEY(source_violation_id,vessel_id) REFERENCES vw.violations(id,vessel_id)`


## backup_runs — Backup job metadata; not a backup implementation.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `initiated_by` | `uuid REFERENCES vw.users(id) ON DELETE RESTRICT` | Technical actor or null for scheduled job |
| `state` | `text NOT NULL CHECK(state IN ('running','succeeded','failed'))` | Reported job result |
| `backup_reference` | `text` | Restricted opaque backup artifact reference |
| `manifest_sha256` | `text CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$')` | DB and file manifest hash |
| `offsite_verified` | `boolean NOT NULL DEFAULT false` | Offsite verification result |
| `recoverable_at` | `timestamptz` | Verified server-data recovery point |
| `started_at` | `timestamptz NOT NULL DEFAULT now()` | Start |
| `finished_at` | `timestamptz` | Finish |
| `error_note` | `text` | Sanitized failure note |

Table rules:
- `CHECK (finished_at IS NULL OR finished_at>=started_at)`
- `CHECK (state<>'succeeded' OR (finished_at IS NOT NULL AND backup_reference IS NOT NULL AND manifest_sha256 IS NOT NULL AND recoverable_at IS NOT NULL))`
- `CHECK (NOT offsite_verified OR state='succeeded')`


## restore_tests — Separate test restoration outcomes and measured recovery metrics.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `backup_id` | `uuid NOT NULL REFERENCES vw.backup_runs(id) ON DELETE RESTRICT` | Backup tested |
| `tested_by` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Technical tester |
| `state` | `text NOT NULL CHECK(state IN ('running','passed','failed'))` | Recorded outcome |
| `integrity_verified` | `boolean NOT NULL DEFAULT false` | DB and file checks passed |
| `rpo_seconds` | `bigint CHECK(rpo_seconds>=0)` | Observed recovery-point gap |
| `rto_seconds` | `bigint CHECK(rto_seconds>=0)` | Observed elapsed recovery time |
| `started_at` | `timestamptz NOT NULL DEFAULT now()` | Start |
| `finished_at` | `timestamptz` | Finish |
| `notes` | `text` | Findings |

Table rules:
- `CHECK (finished_at IS NULL OR finished_at>=started_at)`
- `CHECK(state<>'passed' OR (integrity_verified AND rpo_seconds IS NOT NULL AND rto_seconds IS NOT NULL AND finished_at IS NOT NULL))`


## announcements — Station-scoped or explicitly global internal announcements.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `publisher_id` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Publisher |
| `title` | `text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200)` | Title |
| `body` | `text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 10000)` | Approved content |
| `audience` | `text NOT NULL CHECK(audience IN ('all_stations','selected_stations'))` | Audience strategy |
| `state` | `text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','withdrawn'))` | Lifecycle |
| `published_at` | `timestamptz` | Publication time |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |

Table rules:
- `CHECK(state<>'published' OR published_at IS NOT NULL)`


## announcement_stations — Explicit station recipients for selected audience.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `announcement_id` | `uuid NOT NULL REFERENCES vw.announcements(id) ON DELETE RESTRICT` | Announcement |
| `station_id` | `uuid NOT NULL REFERENCES vw.stations(id) ON DELETE RESTRICT` | Recipient station |

Table rules:
- `PRIMARY KEY(announcement_id,station_id)`


## announcement_receipts — Per-user read/acknowledgement history.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `announcement_id` | `uuid NOT NULL REFERENCES vw.announcements(id) ON DELETE RESTRICT` | Announcement |
| `user_id` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Recipient account |
| `read_at` | `timestamptz NOT NULL DEFAULT now()` | Read time |
| `acknowledged_at` | `timestamptz` | Acknowledgement time |

Table rules:
- `PRIMARY KEY(announcement_id,user_id)`
- `CHECK(acknowledged_at IS NULL OR acknowledged_at>=read_at)`


## internal_messages — Named sender and private internal message.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | Internal immutable identifier |
| `sender_id` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Sender |
| `subject` | `text NOT NULL CHECK(length(btrim(subject)) BETWEEN 1 AND 200)` | Subject |
| `body` | `text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 10000)` | Message |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Server creation time |



## message_recipients — Explicit named recipients and read receipts.

| Field | Type and inline constraints | Purpose |
|---|---|---|
| `message_id` | `uuid NOT NULL REFERENCES vw.internal_messages(id) ON DELETE RESTRICT` | Message |
| `recipient_id` | `uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT` | Recipient |
| `read_at` | `timestamptz` | Read time |
| `acknowledged_at` | `timestamptz` | Acknowledgement time |

Table rules:
- `PRIMARY KEY(message_id,recipient_id)`
- `CHECK(acknowledged_at IS NULL OR (read_at IS NOT NULL AND acknowledged_at>=read_at))`


## Indexes and lifecycle

See 001 and 002 for normalized registration uniqueness, QR active uniqueness, evidence and notification deduplication, report and lookup indexes. No deletion cascades on operational history; existing session cascade is intentional. Date/time zone and report counting rules require agency confirmation. File contents remain outside the database. No actual SMS/clearance/blacklist action or backup executes merely by inserting rows.

## SQL index register

- `CREATE INDEX sessions_user ON vw.sessions(user_id);`
- `CREATE INDEX sessions_expiry ON vw.sessions(expires_at);`
- `CREATE UNIQUE INDEX vessels_registration_unique ON vw.vessels(lower(btrim(official_registration)));`
- `CREATE INDEX vessels_name_normalized ON vw.vessels(lower(btrim(name)));`
- `CREATE INDEX vessels_station ON vw.vessels(station_id);`
- `CREATE INDEX audit_time ON vw.audit_events(recorded_at DESC,id DESC);`
- `CREATE UNIQUE INDEX qr_one_active_per_vessel ON vw.qr_identifiers(vessel_id) WHERE revoked_at IS NULL;`
- `CREATE UNIQUE INDEX notification_dashboard_once ON vw.notifications(document_version_id,threshold_days,recipient_user_id) WHERE channel='dashboard';`
- `CREATE UNIQUE INDEX notification_sms_once ON vw.notifications(document_version_id,threshold_days,recipient_contact_id) WHERE channel='sms_demo';`
- `CREATE UNIQUE INDEX evidence_inspection_once ON vw.evidence_links(file_id,inspection_version_id) WHERE inspection_version_id IS NOT NULL;`
- `CREATE UNIQUE INDEX evidence_document_once ON vw.evidence_links(file_id,document_version_id) WHERE document_version_id IS NOT NULL;`
- `CREATE INDEX inspections_vessel_time ON vw.inspections(vessel_id,inspected_at DESC);`
- `CREATE INDEX inspections_station_time ON vw.inspections(station_id,inspected_at DESC);`
- `CREATE INDEX documents_vessel ON vw.documents(vessel_id);`
- `CREATE INDEX document_versions_expiry ON vw.document_versions(expiry_date) WHERE expiry_kind='dated';`
- `CREATE INDEX violations_vessel_time ON vw.violations(vessel_id,occurred_at DESC);`
- `CREATE INDEX list_reviews_vessel_time ON vw.list_reviews(vessel_id,created_at DESC);`
- `CREATE INDEX clearance_version ON vw.clearance_events(inspection_version_id,created_at DESC);`
- `CREATE INDEX notification_state ON vw.notifications(state,created_at);`
- `CREATE INDEX sync_actor_state ON vw.sync_requests(actor_id,state);`
- `CREATE INDEX monthly_reports_period ON vw.monthly_reports(period_start,station_id);`
- `CREATE INDEX inbox_recipient ON vw.message_recipients(recipient_id,read_at);`
