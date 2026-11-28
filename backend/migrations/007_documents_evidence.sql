-- Phase 4: daily check log; no mutation of historical versions or evidence.
CREATE TABLE vw.expiration_checks (
 check_date date PRIMARY KEY,
 completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 document_count integer NOT NULL CHECK(document_count>=0),
 expired_required integer NOT NULL CHECK(expired_required>=0),
 due_30 integer NOT NULL CHECK(due_30>=0),
 due_7 integer NOT NULL CHECK(due_7>=0),
 due_1 integer NOT NULL CHECK(due_1>=0),
 unknown_count integer NOT NULL CHECK(unknown_count>=0)
);
CREATE INDEX document_review_latest ON vw.document_reviews(document_version_id,created_at DESC,id DESC);
CREATE INDEX document_type_vessel ON vw.documents(vessel_id,type_id);
CREATE INDEX evidence_revision ON vw.evidence_links(inspection_version_id);
REVOKE ALL ON vw.expiration_checks FROM PUBLIC;

-- Fictional categories only; approved agency taxonomy is still pending.
INSERT INTO vw.document_types(code,name,expiry_expected) VALUES ('DEMO-CERT','Fictional certificate',true),('DEMO-PERMIT','Fictional permit',true),('DEMO-OTHER','Fictional non-expiring record',false);
