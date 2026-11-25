-- MFA enrollment is performed by a local authorized operator, never password-only self-enrollment.
ALTER TABLE vw.users ADD COLUMN mfa_secret_cipher text, ADD COLUMN mfa_last_step bigint CHECK(mfa_last_step>=0);
ALTER TABLE vw.users ADD CONSTRAINT users_mfa_consistency CHECK(mfa_secret_cipher IS NOT NULL OR mfa_last_step IS NULL);
DELETE FROM vw.sessions;
