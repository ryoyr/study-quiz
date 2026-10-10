import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GEMINI_MODEL,
  generateGeminiContent,
  loadGeminiSettings,
} from "../src/services/geminiService.ts";

const restoreProperty = (
  target: typeof globalThis,
  name: "localStorage" | "fetch",
  descriptor: PropertyDescriptor | undefined,
): void => {
  if (descriptor) Object.defineProperty(target, name, descriptor);
  else Reflect.deleteProperty(target, name);
};

test("localStorageを読めない環境でもGemini設定は安全な既定値を返す", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    assert.deepEqual(loadGeminiSettings(), {
      apiKey: "",
      model: DEFAULT_GEMINI_MODEL,
    });
  } finally {
    restoreProperty(globalThis, "localStorage", descriptor);
  }
});

test("利用者によるGemini送信中止をタイムアウトと区別する", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  try {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    });
    const controller = new AbortController();
    const result = generateGeminiContent("test", {
      settings: { apiKey: "test-key", model: "gemini-test" },
      signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(result, /送信を中止しました/);
  } finally {
    restoreProperty(globalThis, "fetch", descriptor);
  }
});

