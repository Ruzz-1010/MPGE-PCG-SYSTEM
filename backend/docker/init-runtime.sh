#!/bin/sh
# Disposable local demo initialization only. No real data.
(
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$VW_DB_APP_PASSWORD" <<'SQL'
CREATE ROLE vesselwatch_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'app_password';
REVOKE CONNECT ON DATABASE vesselwatch_demo FROM PUBLIC;
GRANT CONNECT ON DATABASE vesselwatch_demo TO vesselwatch_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
)
