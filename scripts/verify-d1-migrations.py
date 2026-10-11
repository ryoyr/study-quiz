#!/usr/bin/env python3
"""D1 SQLをSQLite互換で初回・再適用し、件数・版・外部キーを検証する。"""
import json
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
migrations = sorted((root / "workers/quiz-content-db/migrations").glob("*.sql"))
assert [path.name for path in migrations] == ["0001_schema.sql", "0002_seed_content.sql"], [
    path.name for path in migrations
]
manifest = json.loads((root / "public/content/manifest.json").read_text(encoding="utf-8"))
expected = sum(item["questionCount"] for item in manifest["datasets"])

db = sqlite3.connect(":memory:")
for pass_number in (1, 2):
    for path in migrations:
        db.executescript(path.read_text(encoding="utf-8"))
    actual = db.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    version = db.execute(
        "SELECT value FROM content_meta WHERE key='content_version'"
    ).fetchone()[0]
    assert actual == expected, (pass_number, actual, expected)
    assert version == manifest["contentVersion"], (
        pass_number,
        version,
        manifest["contentVersion"],
    )
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []

print(
    f"D1 migrations OK: initial+reapply, {actual} questions, "
    f"contentVersion={version}, foreign_key_violations=0"
)
