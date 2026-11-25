CREATE SCHEMA IF NOT EXISTS vw;
CREATE TABLE vw.stations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{2,20}$'),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE vw.users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,64}$'),
 full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
 password_hash text NOT NULL,
 role text NOT NULL CHECK (role IN ('regional','station','inspector','records','technical')),
 station_id uuid REFERENCES vw.stations(id) ON DELETE RESTRICT,
 active boolean NOT NULL DEFAULT true,
 must_change_password boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((role IN ('regional','technical') AND station_id IS NULL) OR
        (role IN ('station','inspector','records') AND station_id IS NOT NULL))
);
CREATE TABLE vw.sessions (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid NOT NULL REFERENCES vw.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON vw.sessions(user_id);
CREATE INDEX sessions_expiry ON vw.sessions(expires_at);
CREATE TABLE vw.vessels (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 internal_id text GENERATED ALWAYS AS ('VW-' || upper(id::text)) STORED UNIQUE,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 180),
 official_registration text NOT NULL CHECK (length(btrim(official_registration)) BETWEEN 1 AND 100),
 owner_operator text NOT NULL CHECK (length(btrim(owner_operator)) BETWEEN 1 AND 180),
 vessel_type text NOT NULL CHECK (length(btrim(vessel_type)) BETWEEN 1 AND 100),
 station_id uuid NOT NULL REFERENCES vw.stations(id) ON DELETE RESTRICT,
 profile_status text NOT NULL DEFAULT 'active' CHECK (profile_status IN ('active','inactive')),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 created_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 updated_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vessels_registration_unique ON vw.vessels(lower(btrim(official_registration)));
CREATE INDEX vessels_name_normalized ON vw.vessels(lower(btrim(name)));
CREATE INDEX vessels_station ON vw.vessels(station_id);
CREATE TABLE vw.vessel_versions (
 vessel_id uuid NOT NULL REFERENCES vw.vessels(id) ON DELETE RESTRICT,
 version integer NOT NULL,
 snapshot jsonb NOT NULL,
 changed_by uuid NOT NULL REFERENCES vw.users(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(vessel_id,version)
);
CREATE TABLE vw.audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES vw.users(id) ON DELETE RESTRICT,
 station_id uuid REFERENCES vw.stations(id) ON DELETE RESTRICT,
 action text NOT NULL,
 resource_type text NOT NULL,
 resource_id text,
 outcome text NOT NULL CHECK (outcome IN ('success','denied','failure')),
 detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_time ON vw.audit_events(recorded_at DESC,id DESC);
-- Fictional station identifiers; not an official station directory.
INSERT INTO vw.stations(code,name)
SELECT 'DEMO-' || n, 'Sample Station ' || n FROM generate_series(1,9) AS n;
