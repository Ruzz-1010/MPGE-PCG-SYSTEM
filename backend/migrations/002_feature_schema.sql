-- V2.0 candidate schema. Synthetic data only. Do not change 001.
-- Opaque QR lifecycle; no personal data embedded.
CREATE TABLE vw.qr_identifiers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vessel_id uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT,
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 issued_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 revoked_by uuid REFERENCES vw.users(id) ON DELETE RESTRICT,
 CHECK ((revoked_at IS NULL) = (revoked_by IS NULL)),
 CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

-- Private, approved notification contacts; no live SMS.
CREATE TABLE vw.owner_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vessel_id uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT,
 phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 verified_at timestamptz,
 sms_authorized boolean NOT NULL DEFAULT false,
 recorded_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(vessel_id,phone_e164),
 CHECK (NOT sms_authorized OR verified_at IS NOT NULL)
);

-- Versioned candidate inspection forms.
CREATE TABLE vw.checklist_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
 version integer NOT NULL CHECK (version>0),
 active boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(name,version)
);

-- Immutable candidate checklist questions.
CREATE TABLE vw.checklist_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 template_id uuid NOT NULL REFERENCES vw.checklist_templates(id) ON DELETE RESTRICT,
 item_code text NOT NULL,
 prompt text NOT NULL CHECK (length(btrim(prompt))>0),
 ordinal integer NOT NULL CHECK (ordinal>0),
 required boolean NOT NULL DEFAULT true,
 UNIQUE(template_id,item_code),
 UNIQUE(template_id,ordinal),
 UNIQUE(id,template_id)
);

-- Stable inspection identity and responsibility; versions carry workflow.
CREATE TABLE vw.inspections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vessel_id uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT,
 station_id uuid NOT NULL REFERENCES vw.stations(id) ON DELETE RESTRICT,
 inspector_id uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 template_id uuid NOT NULL REFERENCES vw.checklist_templates(id) ON DELETE RESTRICT,
 inspected_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,template_id),
 UNIQUE(id,vessel_id)
);

-- Append-only draft, review and correction snapshots.
CREATE TABLE vw.inspection_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 inspection_id uuid NOT NULL REFERENCES vw.inspections(id) ON DELETE RESTRICT,
 template_id uuid NOT NULL REFERENCES vw.checklist_templates(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK (version>0),
 workflow_state text NOT NULL CHECK (workflow_state IN ('draft','submitted','returned','reviewed')),
 findings text NOT NULL DEFAULT '',
 change_reason text,
 changed_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(inspection_id,version),
 UNIQUE(id,template_id),
 UNIQUE(id,inspection_id),
 FOREIGN KEY(inspection_id,template_id) REFERENCES vw.inspections(id,template_id),
 CHECK (workflow_state <> 'returned' OR length(btrim(coalesce(change_reason,'')))>0)
);

-- One answer per item per inspection version.
CREATE TABLE vw.checklist_answers (
 inspection_version_id uuid NOT NULL REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT,
 template_id uuid NOT NULL REFERENCES vw.checklist_templates(id) ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES vw.checklist_items(id) ON DELETE RESTRICT,
 answer text NOT NULL CHECK (answer IN ('pass','fail','not_applicable','not_checked')),
 remarks text,
 PRIMARY KEY(inspection_version_id,item_id),
 FOREIGN KEY(inspection_version_id,template_id) REFERENCES vw.inspection_versions(id,template_id),
 FOREIGN KEY(item_id,template_id) REFERENCES vw.checklist_items(id,template_id)
);

-- Demo attestation records, not a cryptographic signature.
CREATE TABLE vw.inspection_attestations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 inspection_version_id uuid NOT NULL REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT,
 attested_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 statement text NOT NULL CHECK (length(btrim(statement))>0),
 is_simulated boolean NOT NULL DEFAULT true CHECK(is_simulated),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(inspection_version_id,attested_by)
);

-- Separate append-only simulated clearance decisions; never official.
CREATE TABLE vw.clearance_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 inspection_version_id uuid NOT NULL REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT,
 decided_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK (status IN ('cleared','hold','withdrawn')),
 reason text NOT NULL CHECK (length(btrim(reason))>0),
 is_simulated boolean NOT NULL DEFAULT true CHECK(is_simulated),
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Candidate document categories; not approved official checklist.
CREATE TABLE vw.document_types (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE,
 name text NOT NULL,
 expiry_expected boolean NOT NULL DEFAULT true,
 active boolean NOT NULL DEFAULT true
);

-- Stable document identity linked to vessel and category.
CREATE TABLE vw.documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vessel_id uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT,
 type_id uuid NOT NULL REFERENCES vw.document_types(id) ON DELETE RESTRICT,
 required boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,vessel_id)
);

-- Private storage metadata only; no public URL.
CREATE TABLE vw.private_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 storage_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 original_name text NOT NULL CHECK (length(original_name) BETWEEN 1 AND 255),
 media_type text NOT NULL CHECK (media_type IN ('application/pdf','image/jpeg','image/png')),
 byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 20971520),
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 scan_state text NOT NULL DEFAULT 'pending' CHECK (scan_state IN ('pending','accepted','rejected')),
 uploaded_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Versioned document metadata and scanned file.
CREATE TABLE vw.document_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES vw.documents(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version>0),
 number text NOT NULL CHECK(length(btrim(number))>0),
 issuer text NOT NULL CHECK(length(btrim(issuer))>0),
 issue_date date,
 expiry_date date,
 expiry_kind text NOT NULL CHECK(expiry_kind IN ('dated','not_applicable','unknown')),
 file_id uuid REFERENCES vw.private_files(id) ON DELETE RESTRICT,
 recorded_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,version),
 CHECK ((expiry_kind='dated') = (expiry_date IS NOT NULL)),
 CHECK (issue_date IS NULL OR expiry_date IS NULL OR expiry_date>=issue_date)
);

-- Append-only verification results, independent from date validity.
CREATE TABLE vw.document_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_version_id uuid NOT NULL REFERENCES vw.document_versions(id) ON DELETE RESTRICT,
 reviewed_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('verified','rejected','needs_review')),
 reason text,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Attach file to exactly one inspection or document version.
CREATE TABLE vw.evidence_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 file_id uuid NOT NULL REFERENCES vw.private_files(id) ON DELETE RESTRICT,
 inspection_version_id uuid REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT,
 document_version_id uuid REFERENCES vw.document_versions(id) ON DELETE RESTRICT,
 attached_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (num_nonnulls(inspection_version_id,document_version_id)=1)
);

-- Deduplicated document-version alerts and simulated SMS.
CREATE TABLE vw.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_version_id uuid NOT NULL REFERENCES vw.document_versions(id) ON DELETE RESTRICT,
 threshold_days integer NOT NULL CHECK(threshold_days IN (30,7,1,0,-1)),
 channel text NOT NULL CHECK(channel IN ('dashboard','sms_demo')),
 recipient_user_id uuid REFERENCES vw.users(id) ON DELETE RESTRICT,
 recipient_contact_id uuid REFERENCES vw.owner_contacts(id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sent_demo','failed','acknowledged','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 acknowledged_at timestamptz,
 acknowledged_by uuid REFERENCES vw.users(id) ON DELETE RESTRICT,
 CHECK ((channel='dashboard' AND recipient_user_id IS NOT NULL AND recipient_contact_id IS NULL) OR (channel='sms_demo' AND recipient_contact_id IS NOT NULL AND recipient_user_id IS NULL)),
 CHECK ((acknowledged_at IS NULL)=(acknowledged_by IS NULL))
);

-- Append-only simulated delivery and action history.
CREATE TABLE vw.notification_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 notification_id uuid NOT NULL REFERENCES vw.notifications(id) ON DELETE RESTRICT,
 attempt_no integer NOT NULL CHECK(attempt_no>0),
 outcome text NOT NULL CHECK(outcome IN ('sent_demo','failed','acknowledged','cancelled')),
 detail text,
 actor_id uuid REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(notification_id,attempt_no)
);

-- Stable idempotency keys and outcome; no unnecessary raw cached payload.
CREATE TABLE vw.sync_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 device_id uuid NOT NULL,
 client_request_id uuid NOT NULL,
 payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$'),
 inspection_id uuid REFERENCES vw.inspections(id) ON DELETE RESTRICT,
 base_version integer CHECK(base_version>0),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','committed','conflict','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 UNIQUE(actor_id,device_id,client_request_id),
 CHECK(state<>'committed' OR inspection_id IS NOT NULL)
);

-- Explicit conflict record without silent overwrite.
CREATE TABLE vw.sync_conflicts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sync_request_id uuid NOT NULL REFERENCES vw.sync_requests(id) ON DELETE RESTRICT,
 server_version_id uuid REFERENCES vw.inspection_versions(id) ON DELETE RESTRICT,
 reason text NOT NULL,
 resolution text CHECK(resolution IN ('discard','resubmit','manual_merge')),
 resolved_by uuid REFERENCES vw.users(id) ON DELETE RESTRICT,
 resolved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(sync_request_id),
 CHECK ((resolved_at IS NULL AND resolution IS NULL AND resolved_by IS NULL) OR (resolved_at IS NOT NULL AND resolution IS NOT NULL AND resolved_by IS NOT NULL))
);

-- Versionable report run metadata, not an approved counting policy.
CREATE TABLE vw.monthly_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 period_start date NOT NULL CHECK(extract(day FROM period_start)=1),
 station_id uuid REFERENCES vw.stations(id) ON DELETE RESTRICT,
 generated_by uuid REFERENCES vw.users(id) ON DELETE RESTRICT,
 counting_rule text NOT NULL,
 inspected_count integer NOT NULL CHECK(inspected_count>=0),
 cleared_count integer NOT NULL CHECK(cleared_count>=0),
 held_count integer NOT NULL CHECK(held_count>=0),
 pending_count integer NOT NULL CHECK(pending_count>=0),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','reviewed','submitted_demo')),
 export_file_id uuid REFERENCES vw.private_files(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Fictional recorded violation history, not automatic findings.
CREATE TABLE vw.violations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vessel_id uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT,
 inspection_id uuid REFERENCES vw.inspections(id) ON DELETE RESTRICT,
 recorded_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 occurred_at timestamptz NOT NULL,
 violation_type text NOT NULL,
 recorded_penalty text,
 action_taken text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,vessel_id),
 FOREIGN KEY(inspection_id,vessel_id) REFERENCES vw.inspections(id,vessel_id)
);

-- Correction history for fictional violation records.
CREATE TABLE vw.violation_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 violation_id uuid NOT NULL REFERENCES vw.violations(id) ON DELETE RESTRICT,
 changed_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(btrim(reason))>0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Review-only flags and simulated watchlist/blacklist history.
CREATE TABLE vw.list_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vessel_id uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT,
 source_violation_id uuid REFERENCES vw.violations(id) ON DELETE RESTRICT,
 recorded_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('review_flag','watchlist_demo','blacklist_demo')),
 state text NOT NULL CHECK(state IN ('pending','active_demo','dismissed','closed')),
 reason text NOT NULL CHECK(length(btrim(reason))>0),
 is_simulated boolean NOT NULL DEFAULT true CHECK(is_simulated),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(source_violation_id,vessel_id) REFERENCES vw.violations(id,vessel_id)
);

-- Backup job metadata; not a backup implementation.
CREATE TABLE vw.backup_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 initiated_by uuid REFERENCES vw.users(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK(state IN ('running','succeeded','failed')),
 backup_reference text,
 manifest_sha256 text CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 offsite_verified boolean NOT NULL DEFAULT false,
 recoverable_at timestamptz,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 error_note text,
 CHECK (finished_at IS NULL OR finished_at>=started_at),
 CHECK (state<>'succeeded' OR (finished_at IS NOT NULL AND backup_reference IS NOT NULL AND manifest_sha256 IS NOT NULL AND recoverable_at IS NOT NULL)),
 CHECK (NOT offsite_verified OR state='succeeded')
);

-- Separate test restoration outcomes and measured recovery metrics.
CREATE TABLE vw.restore_tests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 backup_id uuid NOT NULL REFERENCES vw.backup_runs(id) ON DELETE RESTRICT,
 tested_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK(state IN ('running','passed','failed')),
 integrity_verified boolean NOT NULL DEFAULT false,
 rpo_seconds bigint CHECK(rpo_seconds>=0),
 rto_seconds bigint CHECK(rto_seconds>=0),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 notes text,
 CHECK (finished_at IS NULL OR finished_at>=started_at),
 CHECK(state<>'passed' OR (integrity_verified AND rpo_seconds IS NOT NULL AND rto_seconds IS NOT NULL AND finished_at IS NOT NULL))
);

-- Station-scoped or explicitly global internal announcements.
CREATE TABLE vw.announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 publisher_id uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 10000),
 audience text NOT NULL CHECK(audience IN ('all_stations','selected_stations')),
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','withdrawn')),
 published_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(state<>'published' OR published_at IS NOT NULL)
);

-- Explicit station recipients for selected audience.
CREATE TABLE vw.announcement_stations (
 announcement_id uuid NOT NULL REFERENCES vw.announcements(id) ON DELETE RESTRICT,
 station_id uuid NOT NULL REFERENCES vw.stations(id) ON DELETE RESTRICT,
 PRIMARY KEY(announcement_id,station_id)
);

-- Per-user read/acknowledgement history.
CREATE TABLE vw.announcement_receipts (
 announcement_id uuid NOT NULL REFERENCES vw.announcements(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 read_at timestamptz NOT NULL DEFAULT now(),
 acknowledged_at timestamptz,
 PRIMARY KEY(announcement_id,user_id),
 CHECK(acknowledged_at IS NULL OR acknowledged_at>=read_at)
);

-- Named sender and private internal message.
CREATE TABLE vw.internal_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_id uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 1 AND 200),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 10000),
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Explicit named recipients and read receipts.
CREATE TABLE vw.message_recipients (
 message_id uuid NOT NULL REFERENCES vw.internal_messages(id) ON DELETE RESTRICT,
 recipient_id uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 read_at timestamptz,
 acknowledged_at timestamptz,
 PRIMARY KEY(message_id,recipient_id),
 CHECK(acknowledged_at IS NULL OR (read_at IS NOT NULL AND acknowledged_at>=read_at))
);

CREATE UNIQUE INDEX qr_one_active_per_vessel ON vw.qr_identifiers(vessel_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX notification_dashboard_once ON vw.notifications(document_version_id,threshold_days,recipient_user_id) WHERE channel='dashboard';
CREATE UNIQUE INDEX notification_sms_once ON vw.notifications(document_version_id,threshold_days,recipient_contact_id) WHERE channel='sms_demo';
CREATE UNIQUE INDEX evidence_inspection_once ON vw.evidence_links(file_id,inspection_version_id) WHERE inspection_version_id IS NOT NULL;
CREATE UNIQUE INDEX evidence_document_once ON vw.evidence_links(file_id,document_version_id) WHERE document_version_id IS NOT NULL;
CREATE INDEX inspections_vessel_time ON vw.inspections(vessel_id,inspected_at DESC);
CREATE INDEX inspections_station_time ON vw.inspections(station_id,inspected_at DESC);
CREATE INDEX documents_vessel ON vw.documents(vessel_id);
CREATE INDEX document_versions_expiry ON vw.document_versions(expiry_date) WHERE expiry_kind='dated';
CREATE INDEX violations_vessel_time ON vw.violations(vessel_id,occurred_at DESC);
CREATE INDEX list_reviews_vessel_time ON vw.list_reviews(vessel_id,created_at DESC);
CREATE INDEX clearance_version ON vw.clearance_events(inspection_version_id,created_at DESC);
CREATE INDEX notification_state ON vw.notifications(state,created_at);
CREATE INDEX sync_actor_state ON vw.sync_requests(actor_id,state);
CREATE INDEX monthly_reports_period ON vw.monthly_reports(period_start,station_id);
CREATE INDEX inbox_recipient ON vw.message_recipients(recipient_id,read_at);
-- Restrict new relations by default. Future API migrations grant only reviewed operations.
REVOKE ALL ON ALL TABLES IN SCHEMA vw FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA vw FROM PUBLIC;
