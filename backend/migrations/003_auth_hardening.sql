-- Additive authentication hardening; 001 and 002 remain immutable.
ALTER TABLE vw.users
 ADD COLUMN failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count BETWEEN 0 AND 5),
 ADD COLUMN login_blocked_until timestamptz;
ALTER TABLE vw.sessions
 ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX sessions_idle ON vw.sessions(user_id,last_seen_at);
-- Existing demo sessions have not previously been tracked for idle time; invalidate them.
DELETE FROM vw.sessions;
