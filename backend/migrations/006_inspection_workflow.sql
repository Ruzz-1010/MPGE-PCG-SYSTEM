-- Phase 3: index history and station/inspector review queues; no new tables.
CREATE INDEX inspections_inspector_time ON vw.inspections(inspector_id,inspected_at DESC,id);
CREATE INDEX inspection_versions_latest ON vw.inspection_versions(inspection_id,version DESC);
CREATE INDEX inspection_attestation_revision ON vw.inspection_attestations(inspection_version_id);
