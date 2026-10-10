import { STORAGE_KEYS } from "./storageKeyRegistry";
import { executeStorageTransaction } from "./storageTransaction";

export interface GeminiSettings {
  apiKey: string;
  model: string;
}

export interface GeminiChatMessage {
  role: "user" | "model";
  text: string;
}

type GenerateOptions = {
  settings?: GeminiSettings;
  history?: GeminiChatMessage[];
  signal?: AbortSignal;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

const readLocalStorage = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const loadGeminiSettings = (): GeminiSettings => ({
  apiKey: readLocalStorage(STORAGE_KEYS.geminiApiKey) ?? "",
  model:
    readLocalStorage(STORAGE_KEYS.geminiModel)?.trim() ||
    DEFAULT_GEMINI_MODEL,
});

export const saveGeminiSettings = (settings: GeminiSettings): void => {
  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim();
  if (!apiKey) throw new Error("Gemini APIキーを入力してください。");
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
    throw new Error("モデル名の形式が不正です。");
  }
  executeStorageTransaction([
    { key: STORAGE_KEYS.geminiApiKey, value: apiKey },
    { key: STORAGE_KEYS.geminiModel, value: model },
  ]);
};

export const clearGeminiSettings = (): void => {
  executeStorageTransaction([
    { key: STORAGE_KEYS.geminiApiKey, value: null },
    { key: STORAGE_KEYS.geminiModel, value: null },
  ]);
};

export const isGeminiConfigured = (): boolean =>
  Boolean(loadGeminiSettings().apiKey);

const responseText = (body: GeminiResponse): string =>
  (body.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

export const generateGeminiContent = async (
  prompt: string,
  options: GenerateOptions = {},
): Promise<string> => {
  const settings = options.settings ?? loadGeminiSettings();
  if (!settings.apiKey.trim()) {
    throw new Error("Gemini APIキーが未設定です。その他 → 設定から登録してください。");
  }
  if (!prompt.trim()) throw new Error("送信する内容を入力してください。");

  const controller = new AbortController();
  let timedOut = false;
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 45_000);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const history = (options.history ?? []).slice(-12).map((item) => ({
      role: item.role,
      parts: [{ text: item.text.slice(0, 12_000) }],
    }));
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model.trim())}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": settings.apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [
            ...history,
            { role: "user", parts: [{ text: prompt.slice(0, 24_000) }] },
          ],
          generationConfig: { maxOutputTokens: 2048 },
        }),
        signal: controller.signal,
      },
    );
    const body = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      throw new Error(
        body.error?.message ||
          `Gemini APIへの接続に失敗しました（HTTP ${response.status}）。`,
      );
    }
    const text = responseText(body);
    if (!text) {
      const reason = body.promptFeedback?.blockReason;
      throw new Error(
        reason
          ? `Geminiが応答を返しませんでした（${reason}）。`
          : "Geminiから空の応答が返されました。",
      );
    }
    return text;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        timedOut
          ? "Gemini APIへの接続がタイムアウトしました。"
          : "Gemini APIへの送信を中止しました。",
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
};

export const testGeminiConnection = async (
  settings: GeminiSettings,
): Promise<void> => {
  await generateGeminiContent(
    "接続確認です。日本語で「接続OK」とだけ回答してください。",
    { settings },
  );
};
