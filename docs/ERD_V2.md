# Database ERD V2.0

36 tables, split into readable views. Dashed relationships are non-identifying; each FK parent has zero or more children; a nullable FK permits zero parents. Composite FKs constrain the same template/vessel and are documented in the dictionary. Repeated parent entities are intentional. Mermaid renders in GitHub.

## Registry, access, audit

```mermaid
erDiagram
    stations {
        uuid id PK
        text code
        text name
        boolean active
    }
    users {
        uuid id PK
        text username
        text full_name
        text password_hash
        text role
        uuid station_id FK
        boolean active
        boolean must_change_password
        timestamptz created_at
    }
    sessions {
        text token_hash PK
        uuid user_id FK
        timestamptz created_at
        timestamptz expires_at
    }
    vessels {
        uuid id PK
        text internal_id
        text name
        text official_registration
        text owner_operator
        text vessel_type
        uuid station_id FK
        text profile_status
        integer version
        uuid created_by FK
        uuid updated_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    vessel_versions {
        uuid vessel_id PK, FK
        integer version PK
        jsonb snapshot
        uuid changed_by FK
        timestamptz recorded_at
    }
    audit_events {
        bigint id PK
        uuid actor_id FK
        uuid station_id FK
        text action
        text resource_type
        text resource_id
        text outcome
        jsonb detail
        timestamptz recorded_at
    }
    qr_identifiers {
        uuid id PK
        uuid vessel_id FK
        uuid token
        uuid issued_by FK
        timestamptz created_at
        timestamptz revoked_at
        uuid revoked_by FK
    }
    owner_contacts {
        uuid id PK
        uuid vessel_id FK
        text phone_e164
        timestamptz verified_at
        boolean sms_authorized
        uuid recorded_by FK
        timestamptz created_at
    }
    stations o|..o{ users : station_id
    users ||..o{ sessions : user_id
    stations ||..o{ vessels : station_id
    users ||..o{ vessels : created_by
    users ||..o{ vessels : updated_by
    vessels ||..o{ vessel_versions : vessel_id
    users ||..o{ vessel_versions : changed_by
    users o|..o{ audit_events : actor_id
    stations o|..o{ audit_events : station_id
    vessels ||..o{ qr_identifiers : vessel_id
    users ||..o{ qr_identifiers : issued_by
    users o|..o{ qr_identifiers : revoked_by
    vessels ||..o{ owner_contacts : vessel_id
    users ||..o{ owner_contacts : recorded_by
```

## Inspections and evidence

```mermaid
erDiagram
    checklist_templates {
        uuid id PK
        text name
        integer version
        boolean active
        uuid created_by FK
        timestamptz created_at
    }
    checklist_items {
        uuid id PK
        uuid template_id FK
        text item_code
        text prompt
        integer ordinal
        boolean required
    }
    inspections {
        uuid id PK
        uuid vessel_id FK
        uuid station_id FK
        uuid inspector_id FK
        uuid template_id FK
        timestamptz inspected_at
        timestamptz created_at
    }
    inspection_versions {
        uuid id PK
        uuid inspection_id FK
        uuid template_id FK
        integer version
        text workflow_state
        text findings
        text change_reason
        uuid changed_by FK
        timestamptz created_at
    }
    checklist_answers {
        uuid inspection_version_id PK, FK
        uuid template_id FK
        uuid item_id PK, FK
        text answer
        text remarks
    }
    inspection_attestations {
        uuid id PK
        uuid inspection_version_id FK
        uuid attested_by FK
        text statement
        boolean is_simulated
        timestamptz created_at
    }
    clearance_events {
        uuid id PK
        uuid inspection_version_id FK
        uuid decided_by FK
        text status
        text reason
        boolean is_simulated
        timestamptz created_at
    }
    private_files {
        uuid id PK
        uuid storage_key
        text original_name
        text media_type
        bigint byte_size
        text sha256
        text scan_state
        uuid uploaded_by FK
        timestamptz created_at
    }
    document_versions {
        uuid id PK
        uuid document_id FK
        integer version
        text number
        text issuer
        date issue_date
        date expiry_date
        text expiry_kind
        uuid file_id FK
        uuid recorded_by FK
        timestamptz created_at
    }
    evidence_links {
        uuid id PK
        uuid file_id FK
        uuid inspection_version_id FK
        uuid document_version_id FK
        uuid attached_by FK
        timestamptz created_at
    }
    users ||..o{ checklist_templates : created_by
    checklist_templates ||..o{ checklist_items : template_id
    vessels ||..o{ inspections : vessel_id
    stations ||..o{ inspections : station_id
    users ||..o{ inspections : inspector_id
    checklist_templates ||..o{ inspections : template_id
    inspections ||..o{ inspection_versions : inspection_id
    checklist_templates ||..o{ inspection_versions : template_id
    users ||..o{ inspection_versions : changed_by
    inspection_versions ||..o{ checklist_answers : inspection_version_id
    checklist_templates ||..o{ checklist_answers : template_id
    checklist_items ||..o{ checklist_answers : item_id
    inspection_versions ||..o{ inspection_attestations : inspection_version_id
    users ||..o{ inspection_attestations : attested_by
    inspection_versions ||..o{ clearance_events : inspection_version_id
    users ||..o{ clearance_events : decided_by
    users ||..o{ private_files : uploaded_by
    documents ||..o{ document_versions : document_id
    private_files o|..o{ document_versions : file_id
    users ||..o{ document_versions : recorded_by
    private_files ||..o{ evidence_links : file_id
    inspection_versions o|..o{ evidence_links : inspection_version_id
    document_versions o|..o{ evidence_links : document_version_id
    users ||..o{ evidence_links : attached_by
```

## Documents, notifications, sync

```mermaid
erDiagram
    owner_contacts {
        uuid id PK
        uuid vessel_id FK
        text phone_e164
        timestamptz verified_at
        boolean sms_authorized
        uuid recorded_by FK
        timestamptz created_at
    }
    inspections {
        uuid id PK
        uuid vessel_id FK
        uuid station_id FK
        uuid inspector_id FK
        uuid template_id FK
        timestamptz inspected_at
        timestamptz created_at
    }
    inspection_versions {
        uuid id PK
        uuid inspection_id FK
        uuid template_id FK
        integer version
        text workflow_state
        text findings
        text change_reason
        uuid changed_by FK
        timestamptz created_at
    }
    document_types {
        uuid id PK
        text code
        text name
        boolean expiry_expected
        boolean active
    }
    documents {
        uuid id PK
        uuid vessel_id FK
        uuid type_id FK
        boolean required
        uuid created_by FK
        timestamptz created_at
    }
    private_files {
        uuid id PK
        uuid storage_key
        text original_name
        text media_type
        bigint byte_size
        text sha256
        text scan_state
        uuid uploaded_by FK
        timestamptz created_at
    }
    document_versions {
        uuid id PK
        uuid document_id FK
        integer version
        text number
        text issuer
        date issue_date
        date expiry_date
        text expiry_kind
        uuid file_id FK
        uuid recorded_by FK
        timestamptz created_at
    }
    document_reviews {
        uuid id PK
        uuid document_version_id FK
        uuid reviewed_by FK
        text status
        text reason
        timestamptz created_at
    }
    notifications {
        uuid id PK
        uuid document_version_id FK
        integer threshold_days
        text channel
        uuid recipient_user_id FK
        uuid recipient_contact_id FK
        text state
        timestamptz created_at
        timestamptz acknowledged_at
        uuid acknowledged_by FK
    }
    notification_attempts {
        uuid id PK
        uuid notification_id FK
        integer attempt_no
        text outcome
        text detail
        uuid actor_id FK
        timestamptz created_at
    }
    sync_requests {
        uuid id PK
        uuid actor_id FK
        uuid device_id
        uuid client_request_id
        text payload_sha256
        uuid inspection_id FK
        integer base_version
        text state
        timestamptz created_at
        timestamptz resolved_at
    }
    sync_conflicts {
        uuid id PK
        uuid sync_request_id FK
        uuid server_version_id FK
        text reason
        text resolution
        uuid resolved_by FK
        timestamptz resolved_at
        timestamptz created_at
    }
    vessels ||..o{ owner_contacts : vessel_id
    users ||..o{ owner_contacts : recorded_by
    vessels ||..o{ inspections : vessel_id
    stations ||..o{ inspections : station_id
    users ||..o{ inspections : inspector_id
    checklist_templates ||..o{ inspections : template_id
    inspections ||..o{ inspection_versions : inspection_id
    checklist_templates ||..o{ inspection_versions : template_id
    users ||..o{ inspection_versions : changed_by
    vessels ||..o{ documents : vessel_id
    document_types ||..o{ documents : type_id
    users ||..o{ documents : created_by
    users ||..o{ private_files : uploaded_by
    documents ||..o{ document_versions : document_id
    private_files o|..o{ document_versions : file_id
    users ||..o{ document_versions : recorded_by
    document_versions ||..o{ document_reviews : document_version_id
    users ||..o{ document_reviews : reviewed_by
    document_versions ||..o{ notifications : document_version_id
    users o|..o{ notifications : recipient_user_id
    owner_contacts o|..o{ notifications : recipient_contact_id
    users o|..o{ notifications : acknowledged_by
    notifications ||..o{ notification_attempts : notification_id
    users o|..o{ notification_attempts : actor_id
    users ||..o{ sync_requests : actor_id
    inspections o|..o{ sync_requests : inspection_id
    sync_requests ||..o| sync_conflicts : sync_request_id
    inspection_versions o|..o{ sync_conflicts : server_version_id
    users o|..o{ sync_conflicts : resolved_by
```

## Reporting, violations, recovery and communication

```mermaid
erDiagram
    monthly_reports {
        uuid id PK
        date period_start
        uuid station_id FK
        uuid generated_by FK
        text counting_rule
        integer inspected_count
        integer cleared_count
        integer held_count
        integer pending_count
        text state
        uuid export_file_id FK
        timestamptz created_at
    }
    violations {
        uuid id PK
        uuid vessel_id FK
        uuid inspection_id FK
        uuid recorded_by FK
        timestamptz occurred_at
        text violation_type
        text recorded_penalty
        text action_taken
        timestamptz created_at
    }
    violation_revisions {
        uuid id PK
        uuid violation_id FK
        uuid changed_by FK
        text reason
        jsonb snapshot
        timestamptz created_at
    }
    list_reviews {
        uuid id PK
        uuid vessel_id FK
        uuid source_violation_id FK
        uuid recorded_by FK
        text kind
        text state
        text reason
        boolean is_simulated
        timestamptz created_at
    }
    backup_runs {
        uuid id PK
        uuid initiated_by FK
        text state
        text backup_reference
        text manifest_sha256
        boolean offsite_verified
        timestamptz recoverable_at
        timestamptz started_at
        timestamptz finished_at
        text error_note
    }
    restore_tests {
        uuid id PK
        uuid backup_id FK
        uuid tested_by FK
        text state
        boolean integrity_verified
        bigint rpo_seconds
        bigint rto_seconds
        timestamptz started_at
        timestamptz finished_at
        text notes
    }
    announcements {
        uuid id PK
        uuid publisher_id FK
        text title
        text body
        text audience
        text state
        timestamptz published_at
        timestamptz created_at
    }
    announcement_stations {
        uuid announcement_id PK, FK
        uuid station_id PK, FK
    }
    announcement_receipts {
        uuid announcement_id PK, FK
        uuid user_id PK, FK
        timestamptz read_at
        timestamptz acknowledged_at
    }
    internal_messages {
        uuid id PK
        uuid sender_id FK
        text subject
        text body
        timestamptz created_at
    }
    message_recipients {
        uuid message_id PK, FK
        uuid recipient_id PK, FK
        timestamptz read_at
        timestamptz acknowledged_at
    }
    stations o|..o{ monthly_reports : station_id
    users o|..o{ monthly_reports : generated_by
    private_files o|..o{ monthly_reports : export_file_id
    vessels ||..o{ violations : vessel_id
    inspections o|..o{ violations : inspection_id
    users ||..o{ violations : recorded_by
    violations ||..o{ violation_revisions : violation_id
    users ||..o{ violation_revisions : changed_by
    vessels ||..o{ list_reviews : vessel_id
    violations o|..o{ list_reviews : source_violation_id
    users ||..o{ list_reviews : recorded_by
    users o|..o{ backup_runs : initiated_by
    backup_runs ||..o{ restore_tests : backup_id
    users ||..o{ restore_tests : tested_by
    users ||..o{ announcements : publisher_id
    announcements ||..o{ announcement_stations : announcement_id
    stations ||..o{ announcement_stations : station_id
    announcements ||..o{ announcement_receipts : announcement_id
    users ||..o{ announcement_receipts : user_id
    users ||..o{ internal_messages : sender_id
    internal_messages ||..o{ message_recipients : message_id
    users ||..o{ message_recipients : recipient_id
```

## Business invariants not enforced by cardinality

Approval-dependent records are simulation-only. Current version selection, permitted cross-station history, state transitions, actor authority, report counting, scoped audiences, sync retries, and transactional audit coverage require application logic and integration tests. Future tables are inaccessible to the existing runtime role until those checks are delivered.

## Composite relationship integrity

- inspection_versions (inspection_id, template_id) → inspections (id, template_id).
- checklist_answers (inspection_version_id, template_id) → inspection_versions (id, template_id); (item_id, template_id) → checklist_items (id, template_id).
- violations (inspection_id, vessel_id) → inspections (id, vessel_id); inspection_id optional.
- list_reviews (source_violation_id, vessel_id) → violations (id, vessel_id); source_violation_id optional.
- Active QR is unique per vessel; historical revoked QR rows remain one-to-many. Evidence/alert recipient deduplication is enforced with partial unique indexes.
