CREATE TABLE IF NOT EXISTS mocktest_passage_typing_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  passage_id INTEGER NOT NULL,
  mobile TEXT,
  guest_id_hash TEXT,
  keystrokes_count INTEGER NOT NULL DEFAULT 0 CHECK (keystrokes_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  backspace_count INTEGER NOT NULL DEFAULT 0 CHECK (backspace_count >= 0),
  total_word_count INTEGER NOT NULL DEFAULT 0 CHECK (total_word_count >= 0),
  typed_word_count INTEGER NOT NULL DEFAULT 0 CHECK (typed_word_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, passage_id),
  CHECK ((mobile IS NOT NULL AND guest_id_hash IS NULL) OR (mobile IS NULL AND guest_id_hash IS NOT NULL)),
  FOREIGN KEY (passage_id) REFERENCES mocktest_passages(id)
);

CREATE INDEX IF NOT EXISTS idx_mocktest_passage_typing_results_session_id
  ON mocktest_passage_typing_results (session_id, passage_id);

CREATE INDEX IF NOT EXISTS idx_mocktest_passage_typing_results_mobile
  ON mocktest_passage_typing_results (mobile, session_id);

CREATE INDEX IF NOT EXISTS idx_mocktest_passage_typing_results_guest_id_hash
  ON mocktest_passage_typing_results (guest_id_hash, session_id);
