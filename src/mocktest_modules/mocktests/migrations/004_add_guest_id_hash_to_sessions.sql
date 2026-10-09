ALTER TABLE sessions ADD COLUMN guest_id_hash TEXT;
CREATE INDEX idx_sessions_guest_id_hash ON sessions (guest_id_hash);