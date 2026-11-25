-- Run as schema owner after migrations. Create vesselwatch_app LOGIN separately.
-- The application must NOT use the schema owner or a superuser.
REVOKE ALL ON SCHEMA vw FROM PUBLIC;
GRANT USAGE ON SCHEMA vw TO vesselwatch_app;
GRANT SELECT ON vw.stations TO vesselwatch_app;
REVOKE UPDATE ON vw.users FROM vesselwatch_app;
GRANT SELECT, INSERT ON vw.users TO vesselwatch_app;
GRANT UPDATE (password_hash, active, must_change_password, failed_login_count, login_blocked_until, mfa_last_step) ON vw.users TO vesselwatch_app;
GRANT SELECT, INSERT, DELETE ON vw.sessions TO vesselwatch_app;
GRANT UPDATE (last_seen_at) ON vw.sessions TO vesselwatch_app;
REVOKE UPDATE ON vw.vessels FROM vesselwatch_app;
GRANT SELECT, INSERT ON vw.vessels TO vesselwatch_app;
GRANT UPDATE (name,official_registration,owner_operator,vessel_type,profile_status,version,updated_at,updated_by) ON vw.vessels TO vesselwatch_app;
GRANT SELECT, INSERT ON vw.vessel_versions TO vesselwatch_app;
GRANT SELECT, INSERT ON vw.audit_events TO vesselwatch_app;
GRANT USAGE, SELECT ON SEQUENCE vw.audit_events_id_seq TO vesselwatch_app;
-- No runtime UPDATE/DELETE grants on audit events or historical snapshots.
