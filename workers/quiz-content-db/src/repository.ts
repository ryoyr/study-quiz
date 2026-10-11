import { ApiError } from "./http";
import type { AccessIdentity, ApplyCommand, ApplyResult, D1PreparedStatement, Question, WorkerEnv } from "./types";
import { fingerprint } from "./validation";

interface DatasetRow { id: string; version: number; title: string; updated_at: string; }
interface QuestionRow {
  id: string; dataset_id: string; exam_scope_id: string; category: string; subcategory: string | null;
  text: string; question_type: "single" | "multiple" | "text"; choices_json: string; answer_index: number;
  answer_indices_json: string | null; accepted_answers_json: string | null; explanation: string;
  source: string | null; tags_json: string | null; weight: number; difficulty: number;
  archived_at: string | null; revision: number; content_hash: string; created_at: string; updated_at: string;
}
interface MetaRow { value: string; updated_at: string; }
interface IdempotencyRow { response_json: string; }

const parseArray = <T>(value: string | null, fallback: T[]): T[] =>
  value === null ? fallback : JSON.parse(value) as T[];

const questionFromRow = (row: QuestionRow): Question => ({
  id: row.id,
  examScopeId: row.exam_scope_id,
  category: row.category,
  ...(row.subcategory ? { subcategory: row.subcategory } : {}),
  text: row.text,
  questionType: row.question_type,
  choices: parseArray<string>(row.choices_json, []),
  answerIndex: row.answer_index,
  ...(row.answer_indices_json ? { answerIndices: parseArray<number>(row.answer_indices_json, []) } : {}),
  ...(row.accepted_answers_json ? { acceptedAnswers: parseArray<string>(row.accepted_answers_json, []) } : {}),
  explanation: row.explanation,
  ...(row.source ? { source: row.source } : {}),
  ...(row.tags_json ? { tags: parseArray<string>(row.tags_json, []) } : {}),
  weight: row.weight,
  difficulty: row.difficulty,
  ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
});

export const readQuestionMasterSnapshot = async (env: WorkerEnv): Promise<unknown> => {
  const [meta, datasetResult, questionResult] = await Promise.all([
    env.DB.prepare("SELECT value, updated_at FROM content_meta WHERE key = 'content_version'").first<MetaRow>(),
    env.DB.prepare("SELECT id, version, title, updated_at FROM datasets ORDER BY id").all<DatasetRow>(),
    env.DB.prepare("SELECT * FROM questions ORDER BY dataset_id, id").all<QuestionRow>(),
  ]);
  if (!meta || datasetResult.results.length === 0) {
    throw new ApiError(503, "D1_NOT_INITIALIZED", "D1に問題マスターが初期化されていません。", "migrationを適用してください。");
  }
  const questionsByDataset = new Map<string, Question[]>();
  for (const row of questionResult.results) {
    const items = questionsByDataset.get(row.dataset_id) ?? [];
    items.push(questionFromRow(row));
    questionsByDataset.set(row.dataset_id, items);
  }
  const datasets = datasetResult.results.map((dataset) => ({
    schemaVersion: 1 as const,
    datasetId: dataset.id,
    version: dataset.version,
    questions: questionsByDataset.get(dataset.id) ?? [],
  }));
  return {
    manifest: {
      schemaVersion: 1,
      contentVersion: meta.value,
      updatedAt: meta.updated_at,
      datasets: datasetResult.results.map((dataset) => ({
        id: dataset.id,
        version: dataset.version,
        path: `questions/${dataset.id}.json`,
        questionCount: questionsByDataset.get(dataset.id)?.length ?? 0,
      })),
    },
    datasets,
    questions: datasets.flatMap((dataset) => dataset.questions),
  };
};

const datasetVersions = async (env: WorkerEnv): Promise<Record<string, number>> => {
  const result = await env.DB.prepare("SELECT id, version, title, updated_at FROM datasets ORDER BY id").all<DatasetRow>();
  return Object.fromEntries(result.results.map((row) => [row.id, row.version]));
};

const nextContentVersion = (previous: string, now: Date): string => {
  const day = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}.${String(now.getUTCDate()).padStart(2, "0")}`;
  const match = previous.match(/^(\d{4}\.\d{2}\.\d{2})\.(\d+)$/u);
  return `${day}.${match?.[1] === day ? Number(match[2]) + 1 : 1}`;
};

const acquireWriteLock = async (env: WorkerEnv, token: string, now: Date): Promise<void> => {
  const expires = new Date(now.getTime() + 30_000).toISOString();
  const result = await env.DB.prepare(
    "UPDATE content_write_lock SET token = ?, expires_at = ? WHERE id = 1 AND (token = '' OR expires_at < ?)",
  ).bind(token, expires, now.toISOString()).run();
  if ((result.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "WRITE_IN_PROGRESS", "別のD1更新が進行中です。", "数秒待ってから最新版を再取得してください。");
  }
};

const releaseWriteLock = async (env: WorkerEnv, token: string): Promise<void> => {
  await env.DB.prepare(
    "UPDATE content_write_lock SET token = '', expires_at = '1970-01-01T00:00:00.000Z' WHERE id = 1 AND token = ?",
  ).bind(token).run();
};

const insertQuestionStatement = (env: WorkerEnv, question: Question, datasetId: string, hash: string, now: string): D1PreparedStatement =>
  env.DB.prepare(`INSERT INTO questions (
    id,dataset_id,exam_scope_id,category,subcategory,text,question_type,choices_json,answer_index,
    answer_indices_json,accepted_answers_json,explanation,source,tags_json,weight,difficulty,archived_at,
    content_hash,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    question.id, datasetId, question.examScopeId, question.category, question.subcategory ?? null,
    question.text, question.questionType ?? "single", JSON.stringify(question.choices), question.answerIndex,
    question.answerIndices ? JSON.stringify(question.answerIndices) : null,
    question.acceptedAnswers ? JSON.stringify(question.acceptedAnswers) : null,
    question.explanation, question.source ?? null, question.tags ? JSON.stringify(question.tags) : null,
    question.weight, question.difficulty, question.archivedAt ?? null, hash, now, now,
  );

const updateQuestionStatement = (
  env: WorkerEnv,
  question: Question,
  datasetId: string,
  hash: string,
  previousHash: string,
  now: string,
): D1PreparedStatement => env.DB.prepare(`UPDATE questions SET
  dataset_id=?,exam_scope_id=?,category=?,subcategory=?,text=?,question_type=?,choices_json=?,answer_index=?,
  answer_indices_json=?,accepted_answers_json=?,explanation=?,source=?,tags_json=?,weight=?,difficulty=?,archived_at=?,
  revision=revision+1,content_hash=?,updated_at=? WHERE id=? AND content_hash=?`).bind(
    datasetId, question.examScopeId, question.category, question.subcategory ?? null, question.text,
    question.questionType ?? "single", JSON.stringify(question.choices), question.answerIndex,
    question.answerIndices ? JSON.stringify(question.answerIndices) : null,
    question.acceptedAnswers ? JSON.stringify(question.acceptedAnswers) : null,
    question.explanation, question.source ?? null, question.tags ? JSON.stringify(question.tags) : null,
    question.weight, question.difficulty, question.archivedAt ?? null, hash, now, question.id, previousHash,
  );

export const applyQuestionChanges = async (
  env: WorkerEnv,
  command: ApplyCommand,
  identity: AccessIdentity,
  now = new Date(),
): Promise<ApplyResult> => {
  const reused = await env.DB.prepare("SELECT response_json FROM idempotency_keys WHERE key = ?")
    .bind(command.idempotencyKey).first<IdempotencyRow>();
  if (reused) return { ...(JSON.parse(reused.response_json) as ApplyResult), reused: true };

  const lockToken = crypto.randomUUID();
  await acquireWriteLock(env, lockToken, now);
  try {
    const duplicateAfterLock = await env.DB.prepare("SELECT response_json FROM idempotency_keys WHERE key = ?")
      .bind(command.idempotencyKey).first<IdempotencyRow>();
    if (duplicateAfterLock) return { ...(JSON.parse(duplicateAfterLock.response_json) as ApplyResult), reused: true };

    const meta = await env.DB.prepare("SELECT value, updated_at FROM content_meta WHERE key = 'content_version'").first<MetaRow>();
    if (!meta || meta.value !== command.baseContentVersion) {
      throw new ApiError(409, "CONTENT_VERSION_CONFLICT", "D1問題マスターが更新されています。", "最新版を取得して差分を確認し直してください。");
    }
    const currentVersions = await datasetVersions(env);
    for (const [datasetId, version] of Object.entries(command.baseDatasetVersions)) {
      if (currentVersions[datasetId] !== version) {
        throw new ApiError(409, "DATASET_VERSION_CONFLICT", `D1データセット ${datasetId} が更新されています。`, "最新版を取得してください。");
      }
    }

    const currentRows = new Map<string, QuestionRow | null>();
    for (const change of command.changes) {
      if (!(change.datasetId in currentVersions)) throw new ApiError(400, "UNKNOWN_DATASET", `データセット ${change.datasetId} は存在しません。`);
      const row = await env.DB.prepare("SELECT * FROM questions WHERE id = ?").bind(change.questionId).first<QuestionRow>();
      currentRows.set(change.questionId, row);
      if (change.operation === "add" && row) throw new ApiError(409, "QUESTION_EXISTS", `問題 ${change.questionId} は既にD1に存在します。`);
      if (change.operation !== "add" && (!row || row.content_hash !== change.baseFingerprint)) {
        throw new ApiError(409, "QUESTION_CONFLICT", `問題 ${change.questionId} はD1側で変更されています。`, "最新版を取得して再確認してください。");
      }
    }

    const nowIso = now.toISOString();
    const contentVersion = nextContentVersion(meta.value, now);
    const touchedDatasets = new Set(command.changes.map((change) => change.datasetId));
    const nextVersions = { ...currentVersions };
    for (const datasetId of touchedDatasets) nextVersions[datasetId] += 1;
    const statements: D1PreparedStatement[] = [];
    const mutationIndexes: number[] = [];

    for (const change of command.changes) {
      const row = currentRows.get(change.questionId) ?? null;
      const hash = fingerprint(change.after);
      mutationIndexes.push(statements.length);
      statements.push(
        change.operation === "add"
          ? insertQuestionStatement(env, change.after, change.datasetId, hash, nowIso)
          : updateQuestionStatement(env, change.after, change.datasetId, hash, row!.content_hash, nowIso),
      );
      statements.push(env.DB.prepare(`INSERT INTO question_revisions
        (question_id,dataset_id,operation,before_json,after_json,actor_subject,actor_email,message,idempotency_key,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
          change.questionId, change.datasetId, change.operation,
          row ? JSON.stringify(questionFromRow(row)) : null, JSON.stringify(change.after),
          identity.subject, identity.email, command.message.trim(), command.idempotencyKey, nowIso,
        ));
    }
    for (const datasetId of touchedDatasets) {
      statements.push(env.DB.prepare("UPDATE datasets SET version = ?, updated_at = ? WHERE id = ?")
        .bind(nextVersions[datasetId], nowIso, datasetId));
    }
    statements.push(env.DB.prepare("UPDATE content_meta SET value = ?, updated_at = ? WHERE key = 'content_version'")
      .bind(contentVersion, nowIso));
    const result: ApplyResult = {
      contentVersion,
      datasetVersions: nextVersions,
      appliedCount: command.changes.length,
      reused: false,
      updatedAt: nowIso,
    };
    statements.push(env.DB.prepare("INSERT INTO idempotency_keys(key,response_json,created_at) VALUES (?,?,?)")
      .bind(command.idempotencyKey, JSON.stringify(result), nowIso));

    const batchResults = await env.DB.batch(statements);
    for (const index of mutationIndexes) {
      if ((batchResults[index].meta.changes ?? 0) !== 1) {
        throw new ApiError(409, "QUESTION_CONFLICT", "D1更新中に競合を検出しました。", "最新版を取得してください。");
      }
    }
    return result;
  } finally {
    await releaseWriteLock(env, lockToken).catch(() => undefined);
  }
};

export const readHealth = async (env: WorkerEnv): Promise<unknown> => {
  const [meta, count] = await Promise.all([
    env.DB.prepare("SELECT value, updated_at FROM content_meta WHERE key = 'content_version'").first<MetaRow>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM questions").first<{ count: number }>(),
  ]);
  return { ok: Boolean(meta), contentVersion: meta?.value ?? null, questionCount: count?.count ?? 0 };
};
