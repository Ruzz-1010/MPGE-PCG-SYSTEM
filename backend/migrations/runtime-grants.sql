-- Run as schema owner after migrations. Create vesselwatch_app LOGIN separately.
-- The application must NOT use the schema owner or a superuser.
REVOKE ALL ON SCHEMA vw FROM PUBLIC;
GRANT USAGE ON SCHEMA vw TO vesselwatch_app;
GRANT SELECT ON vw.stations TO vesselwatch_app;
GRANT SELECT, INSERT, UPDATE ON vw.users TO vesselwatch_app;
GRANT SELECT, INSERT, DELETE ON vw.sessions TO vesselwatch_app;
GRANT SELECT, INSERT, UPDATE ON vw.vessels TO vesselwatch_app;
GRANT SELECT, INSERT ON vw.vessel_versions TO vesselwatch_app;
GRANT SELECT, INSERT ON vw.audit_events TO vesselwatch_app;
GRANT USAGE, SELECT ON SEQUENCE vw.audit_events_id_seq TO vesselwatch_app;
-- No runtime UPDATE/DELETE grants on audit events or historical snapshots.
