-- Phase 5: all SMS remains synthetic. No gateway integration.
ALTER TABLE vw.owner_contacts ADD COLUMN is_demo boolean NOT NULL DEFAULT true CHECK(is_demo);
CREATE INDEX notification_recipient_state ON vw.notifications(recipient_user_id,state,created_at DESC);
CREATE INDEX notifications_contact ON vw.notifications(recipient_contact_id,state);
CREATE INDEX notification_history_order ON vw.notification_attempts(notification_id,attempt_no DESC);
