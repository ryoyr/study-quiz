export interface AiJsonAttemptFailure {
  attempt: number;
  message: string;
  responsePreview: string;
}

export interface StructuredAiResult<T> {
  value: T;
  rawText: string;
  jsonText: string;
  attempts: number;
  repaired: boolean;
  failures: AiJsonAttemptFailure[];
}

export interface StructuredAiGenerationOptions<T> {
  prompt: string;
  generate: (prompt: string, attempt: number) => Promise<string>;
  validate: (value: unknown) => T;
  maxAttempts?: number;
  label?: string;
}

const MAX_AI_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_ATTEMPTS = 3;

const removeFence = (value: string): string =>
  value
    .replace(/^\uFEFF/u, "")
    .trim()
    .replace(/^```(?:json|javascript|js)?\s*/iu, "")
    .replace(/\s*```\s*$/u, "")
    .trim();

const stripTrailingCommas = (value: string): string => {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }
    if (character === ",") {
      let cursor = index + 1;
      while (/\s/u.test(value[cursor] ?? "")) cursor += 1;
      if (value[cursor] === "}" || value[cursor] === "]") continue;
    }
    result += character;
  }
  return result;
};

const balancedJsonCandidates = (value: string): string[] => {
  const candidates: string[] = [];
  for (let start = 0; start < value.length; start += 1) {
    const opening = value[start];
    if (opening !== "{" && opening !== "[") continue;
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (let index = start; index < value.length; index += 1) {
      const character = value[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === "{" || character === "[") stack.push(character);
      else if (character === "}" || character === "]") {
        const expected = character === "}" ? "{" : "[";
        if (stack.at(-1) !== expected) break;
        stack.pop();
        if (stack.length === 0) {
          candidates.push(value.slice(start, index + 1));
          break;
        }
      }
    }
  }
  return [...new Set(candidates)].sort((left, right) => right.length - left.length);
};

export const extractAiJsonCandidates = (text: string): string[] => {
  if (new TextEncoder().encode(text).byteLength > MAX_AI_TEXT_BYTES)
    throw new Error("AI応答は5MB以下にしてください。");
  const normalized = removeFence(text);
  return [...new Set([normalized, ...balancedJsonCandidates(normalized)])].filter(
    (item) => item.startsWith("{") || item.startsWith("["),
  );
};

export const parseAiJson = (text: string): {
  value: unknown;
  jsonText: string;
  repaired: boolean;
} => {
  const candidates = extractAiJsonCandidates(text);
  for (const candidate of candidates) {
    try {
      return { value: JSON.parse(candidate) as unknown, jsonText: candidate, repaired: false };
    } catch {
      const repaired = stripTrailingCommas(candidate);
      if (repaired === candidate) continue;
      try {
        return { value: JSON.parse(repaired) as unknown, jsonText: repaired, repaired: true };
      } catch {
        // 次の候補を試す。
      }
    }
  }
  throw new Error(
    "AI応答から有効なJSONを抽出できませんでした。説明文を除き、JSONオブジェクトまたは配列を確認してください。",
  );
};

const preview = (value: string): string =>
  value.replace(/\s+/gu, " ").trim().slice(0, 300);

export const buildAiJsonRepairPrompt = (
  originalPrompt: string,
  invalidResponse: string,
  failure: string,
): string => `${originalPrompt}\n\n前回の応答は受け付けられませんでした。次のエラーだけを修正し、説明文やMarkdownを付けず、指定済みスキーマのJSONだけを再出力してください。新しい事実を追加したり、問題IDを変更したりしないでください。\n\n検証エラー:\n${failure}\n\n前回応答（先頭12,000文字）:\n${invalidResponse.slice(0, 12_000)}`;

export const generateStructuredAiJson = async <T>(
  options: StructuredAiGenerationOptions<T>,
): Promise<StructuredAiResult<T>> => {
  const attempts = Math.max(1, Math.min(MAX_ATTEMPTS, options.maxAttempts ?? MAX_ATTEMPTS));
  const failures: AiJsonAttemptFailure[] = [];
  let prompt = options.prompt;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const rawText = await options.generate(prompt, attempt);
    try {
      const parsed = parseAiJson(rawText);
      return {
        value: options.validate(parsed.value),
        rawText,
        jsonText: parsed.jsonText,
        attempts: attempt,
        repaired: parsed.repaired,
        failures,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ attempt, message, responsePreview: preview(rawText) });
      if (attempt === attempts) {
        throw new Error(
          `${options.label ?? "AI JSON"}を${attempts}回以内に検証できませんでした。最終エラー: ${message}`,
        );
      }
      prompt = buildAiJsonRepairPrompt(options.prompt, rawText, message);
    }
  }
  throw new Error(`${options.label ?? "AI JSON"}を生成できませんでした。`);
};
