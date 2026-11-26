-- Backfill one opaque active QR for pre-existing active profiles only.
INSERT INTO vw.qr_identifiers(vessel_id,issued_by)
SELECT id,created_by FROM vw.vessels v WHERE v.profile_status='active'
 AND NOT EXISTS(SELECT 1 FROM vw.qr_identifiers q WHERE q.vessel_id=v.id AND q.revoked_at IS NULL);
CREATE INDEX vessel_registry_order ON vw.vessels(lower(name),id);
