ALTER TABLE sessions ADD COLUMN mobile TEXT;
CREATE INDEX idx_sessions_mobile ON sessions (mobile);