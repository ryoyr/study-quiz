PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS content_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  exam_scope_id TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('single', 'multiple', 'text')),
  choices_json TEXT NOT NULL,
  answer_index INTEGER NOT NULL,
  answer_indices_json TEXT,
  accepted_answers_json TEXT,
  explanation TEXT NOT NULL,
  source TEXT,
  tags_json TEXT,
  weight REAL NOT NULL CHECK (weight > 0),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  archived_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 8),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_dataset ON questions(dataset_id, id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(exam_scope_id, category);
CREATE INDEX IF NOT EXISTS idx_questions_archived ON questions(archived_at);

CREATE TABLE IF NOT EXISTS question_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('add', 'update', 'archive')),
  before_json TEXT,
  after_json TEXT NOT NULL,
  actor_subject TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  message TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_revisions_question
  ON question_revisions(question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_revisions_idempotency
  ON question_revisions(idempotency_key);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_write_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO content_write_lock(id, token, expires_at)
VALUES (1, '', '1970-01-01T00:00:00.000Z');
