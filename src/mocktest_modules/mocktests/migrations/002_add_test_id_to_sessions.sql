ALTER TABLE sessions ADD COLUMN test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE;
CREATE INDEX idx_sessions_test_id ON sessions (test_id);