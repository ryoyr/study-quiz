import assert from "node:assert/strict";
import test from "node:test";
import {
  extractAiJsonCandidates,
  generateStructuredAiJson,
  parseAiJson,
} from "../src/services/aiJsonPipeline.ts";

test("説明文とMarkdownコードフェンスからJSONを抽出する", () => {
  const response = '確認しました。\n```json\n{"value":1,"items":[1,2]}\n```\n以上です。';
  const parsed = parseAiJson(response);
  assert.deepEqual(parsed.value, { value: 1, items: [1, 2] });
  assert.equal(parsed.repaired, false);
  assert.ok(extractAiJsonCandidates(response).length >= 1);
});

test("文字列を変更せずオブジェクト・配列末尾カンマだけを安全修復する", () => {
  const parsed = parseAiJson('{"text":"comma, } stays", "items":[1,2,],}');
  assert.deepEqual(parsed.value, { text: "comma, } stays", items: [1, 2] });
  assert.equal(parsed.repaired, true);
});

test("括弧を含むJSON文字列を壊さず最初の有効候補を検証する", () => {
  const parsed = parseAiJson('prefix {"text":"{example}","ok":true} suffix');
  assert.deepEqual(parsed.value, { text: "{example}", ok: true });
});

test("スキーマ不一致時は規定3回以内で修復プロンプトを再生成する", async () => {
  const prompts: string[] = [];
  const outputs = [
    "not json",
    '{"name":""}',
    '{"name":"valid"}',
  ];
  const result = await generateStructuredAiJson({
    prompt: "JSONを出力してください",
    maxAttempts: 3,
    label: "試験JSON",
    generate: async (prompt, attempt) => {
      prompts.push(prompt);
      return outputs[attempt - 1];
    },
    validate: (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("object required");
      const name = (value as { name?: unknown }).name;
      if (typeof name !== "string" || !name.trim()) throw new Error("name required");
      return { name };
    },
  });
  assert.deepEqual(result.value, { name: "valid" });
  assert.equal(result.attempts, 3);
  assert.equal(result.failures.length, 2);
  assert.match(prompts[1], /検証エラー/);
  assert.match(prompts[1], /説明文やMarkdownを付けず/);
});

test("3回すべて不正なら最終エラーを返す", async () => {
  await assert.rejects(
    generateStructuredAiJson({
      prompt: "JSON",
      generate: async () => "invalid",
      validate: () => ({ ok: true }),
    }),
    /3回以内に検証できません/u,
  );
});
