ALTER TABLE mocktest_passage_typing_results ADD COLUMN mobile TEXT;
ALTER TABLE mocktest_passage_typing_results ADD COLUMN guest_id_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_mocktest_passage_typing_results_mobile
  ON mocktest_passage_typing_results (mobile, session_id);

CREATE INDEX IF NOT EXISTS idx_mocktest_passage_typing_results_guest_id_hash
  ON mocktest_passage_typing_results (guest_id_hash, session_id);
