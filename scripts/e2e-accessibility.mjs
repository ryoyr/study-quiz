import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { createServer as createNetServer } from "node:net";
import { pathToFileURL } from "node:url";

const DIST_DIRECTORY = resolve("dist");
const BASE_PATH = "/study-quiz/";
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};
const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const getFreePort = () =>
  new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("空きポートを取得できませんでした。"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
const fileExists = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};
const findBrowser = async () => {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.BROWSER_EXECUTABLE,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/pw-browsers/chromium-1200/chrome-linux64/chrome",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  throw new Error(
    "Chrome/Chromiumが見つかりません。CHROME_PATHへ実行ファイルを指定してください。",
  );
};
const startStaticServer = async () => {
  if (!(await fileExists(join(DIST_DIRECTORY, "index.html")))) {
    throw new Error("dist/index.htmlがありません。先にnpm run buildを実行してください。");
  }
  const server = createServer(async (request, response) => {
    try {
      const rawPath = new URL(request.url ?? "/", "http://localhost").pathname;
      const relativePath = rawPath.startsWith(BASE_PATH)
        ? rawPath.slice(BASE_PATH.length)
        : rawPath.replace(/^\/+/, "");
      const requested = relativePath && relativePath !== "/" ? relativePath : "index.html";
      const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
      let target = resolve(DIST_DIRECTORY, safePath);
      if (!target.startsWith(`${DIST_DIRECTORY}/`) && target !== DIST_DIRECTORY) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      if (!(await fileExists(target))) target = join(DIST_DIRECTORY, "index.html");
      const body = await readFile(target);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": MIME_TYPES[extname(target)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("試験サーバーを起動できませんでした。");
  return { server, origin: `http://127.0.0.1:${address.port}` };
};
class DevToolsClient {
  constructor(url) {
    this.sequence = 0;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolveReady, reject) => {
      this.socket.addEventListener("open", resolveReady, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("Chrome DevToolsへ接続できませんでした。")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.sequence;
    return new Promise((resolveRequest, reject) => {
      this.pending.set(id, { method, resolve: resolveRequest, reject: reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.socket.close();
  }
}
const waitForJson = async (url, timeoutMilliseconds = 15000) => {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Chromeの起動待ちがタイムアウトしました。${lastError ? ` ${lastError}` : ""}`);
};
const evaluate = async (client, expression) => {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
};
const waitFor = async (client, expression, label, timeoutMilliseconds = 10000) => {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(client, expression)) return;
    } catch (error) {
      // reload直後は実行コンテキストが切り替わるため、次のポーリングで再試行する。
      lastError = error;
    }
    await delay(80);
  }
  throw new Error(`${label}の待機がタイムアウトしました。${lastError ? ` ${lastError}` : ""}`);
};
const captureScreenshot = async (client, name) => {
  const directory = process.env.UI_SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const result = await client.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  await writeFile(join(directory, `${name}.png`), Buffer.from(result.data, "base64"));
};
const auditExpression = (screenName) => `(() => {
  const screenName = ${JSON.stringify(screenName)};
  const issues = [];
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const labelledByText = (element) => (element.getAttribute("aria-labelledby") ?? "")
    .split(/\\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
    .join(" ")
    .trim();
  const accessibleName = (element) => {
    const aria = element.getAttribute("aria-label")?.trim();
    if (aria) return aria;
    const labelled = labelledByText(element);
    if (labelled) return labelled;
    if (element instanceof HTMLImageElement) return element.alt.trim();
    if (element.id) {
      const explicit = [...document.querySelectorAll("label")]
        .find((label) => label.htmlFor === element.id)?.textContent?.trim();
      if (explicit) return explicit;
    }
    const wrapping = element.closest("label")?.textContent?.trim();
    if (wrapping) return wrapping;
    if (element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type)) {
      return element.value.trim();
    }
    return element.textContent?.trim() || element.getAttribute("title")?.trim() || "";
  };
  const visibleMains = [...document.querySelectorAll("main")].filter(visible);
  if (visibleMains.length !== 1) issues.push("mainランドマークが" + visibleMains.length + "件です");
  const headings = visibleMains.flatMap((main) => [...main.querySelectorAll("h1")].filter(visible));
  if (headings.length !== 1) issues.push("表示中のh1が" + headings.length + "件です");
  const controls = [...document.querySelectorAll("button, a[href], input, select, textarea")].filter(visible);
  for (const control of controls) {
    if (!accessibleName(control)) issues.push("名前のない操作要素: " + control.outerHTML.slice(0, 100));
  }
  for (const image of [...document.querySelectorAll("img")].filter(visible)) {
    if (!image.hasAttribute("alt")) issues.push("alt属性のない画像: " + image.outerHTML.slice(0, 100));
  }
  const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
  const duplicates = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))];
  if (duplicates.length) issues.push("重複ID: " + duplicates.join(", "));
  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth + 1) {
    const offenders = [...document.querySelectorAll("body *")]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > root.clientWidth + 1;
      })
      .slice(0, 5)
      .map((element) => element.tagName.toLowerCase() + (element.className ? "." + String(element.className).trim().replace(/\\s+/g, ".") : ""));
    issues.push("横スクロールが発生しています (" + root.scrollWidth + "/" + root.clientWidth + "): " + offenders.join(", "));
  }
  return { screenName, issues, heading: headings[0]?.textContent?.trim() ?? "" };
})()`;

const themeContrastExpression = (theme, mode) => `(() => {
  const theme = ${JSON.stringify(theme)};
  const mode = ${JSON.stringify(mode)};
  const root = document.documentElement;
  root.dataset.visualTheme = theme;
  root.dataset.theme = mode;
  const style = getComputedStyle(root);
  const probe = document.createElement("span");
  probe.hidden = true;
  document.body.append(probe);
  const parseColor = (value) => {
    probe.style.color = "";
    probe.style.color = value.trim();
    const parsed = getComputedStyle(probe).color.match(/[\\d.]+/g)?.map(Number) ?? [];
    const [red = 0, green = 0, blue = 0, alpha = 1] = parsed;
    return [red, green, blue, alpha];
  };
  const resolve = (name) => parseColor(style.getPropertyValue(name));
  const composite = (foreground, background) => {
    const alpha = foreground[3] ?? 1;
    return foreground.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha));
  };
  const luminance = (color) => {
    const converted = color.slice(0, 3).map((value) => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return .2126 * converted[0] + .7152 * converted[1] + .0722 * converted[2];
  };
  const contrast = (foregroundName, backgroundName) => {
    const background = resolve(backgroundName);
    const foreground = composite(resolve(foregroundName), background);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  };
  const checks = [
    ["--text-main", "--surface-solid", 4.5],
    ["--text-strong", "--surface-solid", 4.5],
    ["--text-muted", "--surface-solid", 4.5],
    ["--text-link", "--surface-solid", 4.5],
    ["--text-on-accent", "--button-primary", 4.5],
    ["--focus-color", "--surface-solid", 3],
    ["--line-control", "--surface-solid", 3],
    ["--success-text", "--success-soft", 4.5],
    ["--warning-text", "--warning-soft", 4.5],
    ["--danger-text", "--danger-soft", 4.5],
    ["--info-text", "--info-soft", 4.5],
    ["--chart-answers", "--surface-soft", 3],
    ["--chart-unlearned", "--surface-soft", 3],
    ["--chart-learning", "--surface-soft", 3],
    ["--chart-mastered", "--surface-soft", 3],
  ];
  const issues = checks.flatMap(([foreground, background, minimum]) => {
    const ratio = contrast(foreground, background);
    return ratio + .0001 < minimum
      ? [foreground + " / " + background + " = " + ratio.toFixed(2) + ":1（必要 " + minimum + ":1）"]
      : [];
  });
  probe.remove();
  return { theme, mode, issues };
})()`;

const clickButton = async (client, label) => {
  const clicked = await evaluate(
    client,
    `(() => { const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim().includes(${JSON.stringify(label)})); if (!button) return false; button.click(); return true; })()`,
  );
  if (!clicked) throw new Error(`「${label}」ボタンが見つかりません。`);
};
const clickNavigation = async (client, label) => {
  const clicked = await evaluate(
    client,
    `(() => { const button = [...document.querySelectorAll('nav[aria-label="主要機能"] button')].find((item) => item.textContent?.trim().includes(${JSON.stringify(label)})); if (!button) return false; button.click(); return true; })()`,
  );
  if (!clicked) throw new Error(`主要ナビゲーションの「${label}」ボタンが見つかりません。`);
};
const clickLabel = async (client, label) => {
  const clicked = await evaluate(
    client,
    `(() => { const label = [...document.querySelectorAll("label")].find((item) => item.textContent?.trim() === ${JSON.stringify(label)}); const input = label?.querySelector("input"); if (!input) return false; input.click(); return true; })()`,
  );
  if (!clicked) throw new Error(`「${label}」の選択肢が見つかりません。`);
};
const waitForDownloadedJson = async (
  directory,
  prefix,
  timeoutMilliseconds = 10000,
) => {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const names = await readdir(directory);
    const name = names.find(
      (item) =>
        item.startsWith(prefix) &&
        item.endsWith(".json") &&
        !item.endsWith(".crdownload"),
    );
    if (name) return join(directory, name);
    await delay(80);
  }
  throw new Error(`${prefix}から始まるダウンロードファイルを確認できませんでした。`);
};
const answerCurrentQuestion = async (
  client,
  {
    title,
    choices = [],
    textAnswer = "",
    expectedResponseParts,
    expectedCorrectParts,
    nextTitle,
  },
) => {
  await waitFor(
    client,
    `document.querySelector(".question-title")?.textContent?.trim() === ${JSON.stringify(title)}`,
    `${title}の表示`,
  );
  for (const choice of choices) {
    const clicked = await evaluate(
      client,
      `(() => { const button = [...document.querySelectorAll(".choice-button")].find((item) => item.textContent?.includes(${JSON.stringify(choice)})); if (!button) return false; button.click(); return true; })()`,
    );
    if (!clicked) throw new Error(`${title}: 選択肢「${choice}」を選べませんでした。`);
  }
  if (textAnswer) {
    const entered = await evaluate(
      client,
      `(() => { const input = document.querySelector(".quiz-card label input"); if (!input) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(input, ${JSON.stringify(textAnswer)}); input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`,
    );
    if (!entered) throw new Error(`${title}: 入力回答を設定できませんでした。`);
  }
  await clickButton(client, "回答する");
  await waitFor(
    client,
    `Boolean([...document.querySelectorAll(".summary-row")].find((row) => row.querySelector("span")?.textContent?.trim() === "判定"))`,
    `${title}の回答結果`,
  );
  const summary = await evaluate(
    client,
    `(() => Object.fromEntries([...document.querySelectorAll(".summary-row")].map((row) => [row.querySelector("span")?.textContent?.trim(), row.querySelector("strong")?.textContent?.trim()])))()`,
  );
  const responseParts = expectedResponseParts ?? [];
  const correctParts = expectedCorrectParts ?? responseParts;
  if (
    summary["判定"] !== "正解" ||
    !responseParts.every((part) => summary["あなたの回答"]?.includes(part)) ||
    !correctParts.every((part) => summary["正答"]?.includes(part))
  ) {
    throw new Error(`${title}: 回答結果の表示が不正です。${JSON.stringify(summary)}`);
  }
  await clickButton(client, "思い出せた");
  await waitFor(
    client,
    nextTitle
      ? `document.querySelector(".question-title")?.textContent?.trim() === ${JSON.stringify(nextTitle)}`
      : `document.querySelector("main h1")?.textContent?.trim() === "学習結果"`,
    nextTitle ? `${nextTitle}への遷移` : "学習結果への遷移",
  );
};
const runAnswerModeJourney = async (client, downloadDirectory) => {
  const category = "E2E回答方式";
  const ids = ["E2E-SINGLE", "E2E-MULTIPLE", "E2E-TEXT"];
  const csv = [
    [
      "id",
      "examScopeId",
      "category",
      "text",
      "questionType",
      "choice1",
      "choice2",
      "choice3",
      "answer",
      "answers",
      "acceptedAnswers",
      "explanation",
      "source",
      "weight",
      "difficulty",
    ],
    [ids[0], "lpic101", category, "E2E 択一問題", "single", "Single-A", "Single-B", "Single-C", "2", "", "", "択一解説", "E2E", "3", "1"],
    [ids[1], "lpic101", category, "E2E 複数選択問題", "multiple", "Multiple-A", "Multiple-B", "Multiple-C", "", "1|3", "", "複数解説", "E2E", "2", "1"],
    [ids[2], "lpic101", category, "E2E 入力問題", "text", "", "", "", "", "", "LVM|lvm", "入力解説", "E2E", "1", "1"],
  ].map((row) => row.join(",")).join("\n");

  await clickNavigation(client, "管理");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "問題・教材管理"`,
    "問題・教材管理画面",
  );
  await clickButton(client, "問題管理");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "問題管理"`,
    "問題管理画面",
  );
  await clickButton(client, "CSVから一括登録");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "問題CSV一括登録"`,
    "問題CSV一括登録画面",
  );
  await evaluate(
    client,
    `(() => { const input = document.querySelector('input[aria-label="取り込む問題CSV"]'); if (!input) return false; const transfer = new DataTransfer(); transfer.items.add(new File([${JSON.stringify(csv)}], "answer-modes.csv", { type: "text/csv" })); Object.defineProperty(input, "files", { value: transfer.files, configurable: true }); input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`,
  );
  await waitFor(
    client,
    `[...document.querySelectorAll("button")].some((button) => button.textContent?.includes("正常・警告行を登録（3件）") && !button.disabled)`,
    "3方式CSVのプレビュー",
  );
  await clickButton(client, "正常・警告行を登録（3件）");
  await waitFor(
    client,
    `document.querySelector('[role="status"]')?.textContent?.includes("3件を登録しました")`,
    "3方式CSVの登録完了",
  );

  await clickNavigation(client, "学習");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "学習"`,
    "学習画面",
  );
  await clickLabel(client, category);
  await clickLabel(client, "条件一致すべて");
  await waitFor(
    client,
    `document.querySelector(".compact-plan-grid .is-total strong")?.textContent?.trim() === "3"`,
    "3方式の学習候補",
  );
  await clickButton(client, "学習計画を確認して開始");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "学習セッション"`,
    "3方式の学習セッション",
  );
  const plannedCount = await evaluate(
    client,
    `(() => [...document.querySelectorAll(".summary-row")].find((row) => row.querySelector("span")?.textContent?.trim() === "対象問題数")?.querySelector("strong")?.textContent?.trim())()`,
  );
  if (plannedCount !== "3")
    throw new Error(`3方式の対象問題数が不正です: ${plannedCount}`);
  await clickButton(client, "学習開始");

  await answerCurrentQuestion(client, {
    title: "E2E 択一問題",
    choices: ["Single-B"],
    expectedResponseParts: ["Single-B"],
    nextTitle: "E2E 複数選択問題",
  });
  await answerCurrentQuestion(client, {
    title: "E2E 複数選択問題",
    choices: ["Multiple-C", "Multiple-A"],
    expectedResponseParts: ["Multiple-A", "Multiple-C"],
    nextTitle: "E2E 入力問題",
  });
  await answerCurrentQuestion(client, {
    title: "E2E 入力問題",
    textAnswer: "  ｌｖｍ  ",
    expectedResponseParts: ["ｌｖｍ"],
    expectedCorrectParts: ["LVM"],
  });
  const result = await evaluate(
    client,
    `document.querySelector(".result-score span")?.textContent?.replace(/\\s+/g, " ").trim()`,
  );
  if (result !== "3 / 3問正解")
    throw new Error(`3方式の学習結果が不正です: ${result}`);
  await clickButton(client, "ホームへ");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "LinuC 101"`,
    "3方式学習後のホーム画面",
  );

  await clickNavigation(client, "記録");
  await clickButton(client, "学習履歴");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "学習履歴"`,
    "3方式の学習履歴",
  );
  const historyState = await evaluate(
    client,
    `(() => { const raw = localStorage.getItem("study-quiz-answer-history-v1"); const items = raw ? JSON.parse(raw) : []; const targets = items.filter((item) => ${JSON.stringify(ids)}.includes(item.questionId)); return { count: targets.length, types: [...new Set(targets.map((item) => item.answerType))].sort(), selectedIndices: targets.find((item) => item.questionId === "E2E-MULTIPLE")?.selectedIndices, textAnswer: targets.find((item) => item.questionId === "E2E-TEXT")?.textAnswer, snapshots: targets.map((item) => item.questionSnapshot), visible: [...document.querySelectorAll(".history-item")].map((item) => item.textContent) }; })()`,
  );
  if (
    historyState.count !== 3 ||
    JSON.stringify(historyState.types) !== JSON.stringify(["multiple", "single", "text"]) ||
    JSON.stringify(historyState.selectedIndices) !== JSON.stringify([0, 2]) ||
    historyState.textAnswer !== "  ｌｖｍ  " ||
    historyState.snapshots.length !== 3 ||
    historyState.snapshots.some(
      (snapshot) =>
        !snapshot?.questionText ||
        !snapshot?.responseText ||
        !snapshot?.correctAnswerText,
    ) ||
    !ids.every((_id, index) => historyState.visible.some((text) => text?.includes(["E2E 択一問題", "E2E 複数選択問題", "E2E 入力問題"][index])))
  ) {
    throw new Error(`3方式の履歴保存・表示が不正です。${JSON.stringify(historyState)}`);
  }

  await evaluate(
    client,
    `(() => { const ids = new Set(${JSON.stringify(ids)}); const questions = JSON.parse(localStorage.getItem("study-quiz-questions-v1") ?? "[]").map((item) => ids.has(item.id) ? { ...item, text: "編集後 " + item.id, choices: item.choices.map((choice, index) => "編集後選択肢" + (index + 1)) } : item); localStorage.setItem("study-quiz-questions-v1", JSON.stringify(questions)); return true; })()`,
  );
  await client.send("Page.reload", { ignoreCache: true });
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "LinuC 101"`,
    "問題編集後のホーム画面",
  );
  await clickNavigation(client, "記録");
  await clickButton(client, "学習履歴");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "学習履歴"`,
    "問題編集後の学習履歴",
  );
  const snapshotDisplay = await evaluate(
    client,
    `(() => [...document.querySelectorAll(".history-item")].map((item) => item.textContent))()`,
  );
  if (
    !["E2E 択一問題", "E2E 複数選択問題", "E2E 入力問題", "Single-B", "Multiple-A", "Multiple-C", "LVM"].every(
      (text) => snapshotDisplay.some((item) => item?.includes(text)),
    ) ||
    snapshotDisplay.some((item) => item?.includes("編集後"))
  ) {
    throw new Error(
      `問題編集後に回答時点スナップショットを表示できません。${JSON.stringify(snapshotDisplay)}`,
    );
  }

  await clickNavigation(client, "その他");
  await clickButton(client, "完全バックアップ");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "完全バックアップ"`,
    "3方式の完全バックアップ画面",
  );
  await waitFor(
    client,
    `document.querySelector(".storage-health-badge")?.textContent?.trim() === "正常"`,
    "3方式データの健全性確認",
  );
  await rm(downloadDirectory, { force: true, recursive: true });
  await mkdir(downloadDirectory, { recursive: true });
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDirectory,
    eventsEnabled: true,
  });
  await clickButton(client, "完全バックアップを出力");
  const backupPath = await waitForDownloadedJson(
    downloadDirectory,
    "study-quiz-full-backup-",
  );
  const backupText = await readFile(backupPath, "utf8");
  const backup = JSON.parse(backupText);
  const backedUpQuestions = JSON.parse(
    backup.entries?.["study-quiz-questions-v1"] ?? "[]",
  );
  const backedUpHistory = JSON.parse(
    backup.entries?.["study-quiz-answer-history-v1"] ?? "[]",
  );
  if (
    !ids.every((id) => backedUpQuestions.some((item) => item.id === id)) ||
    !ids.every((id) => backedUpHistory.some((item) => item.questionId === id))
  ) {
    throw new Error("完全バックアップに3方式の問題または履歴が含まれていません。");
  }

  await evaluate(
    client,
    `(() => { const ids = new Set(${JSON.stringify(ids)}); const questions = JSON.parse(localStorage.getItem("study-quiz-questions-v1") ?? "[]").filter((item) => !ids.has(item.id)); localStorage.setItem("study-quiz-questions-v1", JSON.stringify(questions)); localStorage.setItem("study-quiz-answer-history-v1", "[]"); localStorage.setItem("study-quiz-question-states-v1", "[]"); localStorage.removeItem("study-quiz-active-session-v1"); return true; })()`,
  );
  await client.send("Page.reload", { ignoreCache: true });
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "LinuC 101"`,
    "3方式データ削除後のホーム画面",
  );
  await clickNavigation(client, "その他");
  await clickButton(client, "完全バックアップ");
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "完全バックアップ"`,
    "3方式データ削除後のバックアップ画面",
  );
  await evaluate(
    client,
    `(() => { const input = document.querySelector('input[aria-label="復元するバックアップJSON"]'); if (!input) return false; const transfer = new DataTransfer(); transfer.items.add(new File([${JSON.stringify(backupText)}], "answer-modes-backup.json", { type: "application/json" })); Object.defineProperty(input, "files", { value: transfer.files, configurable: true }); input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`,
  );
  await waitFor(
    client,
    `Boolean(document.querySelector('[aria-label="現在データとの差分集計"]'))`,
    "3方式バックアップの差分表示",
  );
  await evaluate(
    client,
    `document.querySelector('.backup-restore-confirmation input[type="checkbox"]')?.click(); true`,
  );
  await clickButton(client, "確認した内容で復元");
  await waitFor(
    client,
    `(() => { const questions = JSON.parse(localStorage.getItem("study-quiz-questions-v1") ?? "[]"); const history = JSON.parse(localStorage.getItem("study-quiz-answer-history-v1") ?? "[]"); return ${JSON.stringify(ids)}.every((id) => questions.some((item) => item.id === id) && history.some((item) => item.questionId === id)); })()`,
    "3方式バックアップの復元完了",
  );
  await delay(700);
  await waitFor(
    client,
    `document.querySelector("main h1")?.textContent?.trim() === "LinuC 101"`,
    "3方式バックアップ復元後のホーム画面",
  );
};
const run = async () => {
  const failures = [];
  const reports = [];
  // ブラウザー未導入時にHTTPサーバーだけが残らないよう、先に実行可能性を確認する。
  const browserPath = await findBrowser();
  const { server, origin } = await startStaticServer();
  const profileDirectory = await mkdtemp(join(tmpdir(), "study-quiz-e2e-"));
  const downloadDirectory = await mkdtemp(
    join(tmpdir(), "study-quiz-e2e-downloads-"),
  );
  const debugPort = await getFreePort();
  const browser = spawn(browserPath, [
    "--headless=new",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-sandbox",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: "ignore" });
  let client;
  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
    const pageResponse = await fetch(
      `http://127.0.0.1:${debugPort}/json/new?about:blank`,
      { method: "PUT" },
    );
    const page = pageResponse.ok ? await pageResponse.json() : null;
    if (!page) throw new Error("Chromeの試験ページを取得できませんでした。");
    client = new DevToolsClient(page.webSocketDebuggerUrl);
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Accessibility.enable"),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { delete Navigator.prototype.serviceWorker; } catch { /* noop */ }`,
    });
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 568,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await client.send("Page.navigate", { url: `${origin}${BASE_PATH}` });
    await waitFor(client, `document.querySelector("main h1")?.textContent?.trim() === "初回設定"`, "初回設定画面");
    await captureScreenshot(client, "01-initial-setup-320");
    reports.push(await evaluate(client, auditExpression("初回設定")));
    await evaluate(client, `(() => {
      const input = document.querySelector('input[type="date"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await clickButton(client, "保存して開始");
    await waitFor(client, `document.querySelectorAll('[aria-invalid="true"]').length > 0`, "入力エラー表示");
    const invalidDescriptionComplete = await evaluate(
      client,
      `[...document.querySelectorAll('[aria-invalid="true"]')].every((element) => { const id = element.getAttribute('aria-describedby'); return id && document.getElementById(id)?.textContent?.trim(); })`,
    );
    if (!invalidDescriptionComplete) failures.push("初回設定: 入力エラーと説明文の関連付けが不足しています。");
    const setup = {
      name: "LinuC 101",
      examDate: "2099-12-31",
      dailyNewLimit: 10,
      dailyQuestionLimit: 20,
      bufferRate: 20,
      instantThresholdSeconds: 30,
      dailyMinimumQuestions: 15,
      reservedDates: [],
      setupCompleted: true,
      createdAt: "2026-10-05T00:00:00.000Z",
      updatedAt: "2026-10-05T00:00:00.000Z",
    };
    await evaluate(client, `localStorage.setItem("study-quiz-setup-v1", ${JSON.stringify(JSON.stringify(setup))})`);
    await client.send("Page.reload", { ignoreCache: true });
    await waitFor(client, `document.querySelector("main h1")?.textContent?.trim() === "LinuC 101"`, "ホーム画面");
    await captureScreenshot(client, "02-home-320");
    reports.push(await evaluate(client, auditExpression("ホーム")));

    await runAnswerModeJourney(client, downloadDirectory);

    const themeReports = [];
    for (const theme of ["aurora", "focus", "forest", "sunset", "mono"]) {
      for (const mode of ["light", "dark"]) {
        const report = await evaluate(client, themeContrastExpression(theme, mode));
        themeReports.push(report);
        for (const issue of report.issues) failures.push(`テーマ ${theme}/${mode}: ${issue}`);
      }
    }
    await evaluate(client, `(() => {
      document.documentElement.dataset.visualTheme = "aurora";
      document.documentElement.dataset.theme = "light";
      return true;
    })()`);

    const navigationCases = [
      ["学習", "学習"],
      ["記録", "記録・分析"],
      ["管理", "問題・教材管理"],
      ["その他", "その他"],
      ["ホーム", "LinuC 101"],
    ];
    for (const [buttonLabel, heading] of navigationCases) {
      await clickNavigation(client, buttonLabel);
      await waitFor(
        client,
        `document.querySelector("main h1")?.textContent?.trim() === ${JSON.stringify(heading)}`,
        `${heading}画面`,
      );
      await waitFor(
        client,
        `document.activeElement?.tagName === "H1" && document.activeElement?.textContent?.trim() === ${JSON.stringify(heading)}`,
        `${heading}見出しへのフォーカス移動`,
      );
      reports.push(await evaluate(client, auditExpression(heading)));
    }
    await clickNavigation(client, "管理");
    await clickButton(client, "問題管理");
    await waitFor(client, `document.querySelector("main h1")?.textContent?.trim() === "問題管理"`, "問題管理画面");
    await waitFor(
      client,
      `document.activeElement?.tagName === "H1" && document.activeElement?.textContent?.trim() === "問題管理"`,
      "問題管理見出しへのフォーカス移動",
    );
    const openedConfirmation = await evaluate(client, `(() => {
      const button = document.querySelector('.question-actions .delete-button');
      if (!button) return false;
      button.focus();
      button.click();
      return true;
    })()`);
    if (!openedConfirmation) failures.push("問題管理: アーカイブ確認を開始できません。");
    await waitFor(client, `Boolean(document.querySelector('[role="alertdialog"][aria-modal="true"]'))`, "アーカイブ確認ダイアログ");
    await delay(150);
    const confirmationState = await evaluate(client, `(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      const labelledBy = dialog?.getAttribute('aria-labelledby');
      const describedBy = dialog?.getAttribute('aria-describedby');
      return {
        named: Boolean(labelledBy && document.getElementById(labelledBy)?.textContent?.trim()),
        described: Boolean(describedBy && document.getElementById(describedBy)?.textContent?.trim()),
        safeFocus: document.activeElement?.textContent?.trim() === 'キャンセル',
        scrollLocked: document.body.style.overflow === 'hidden',
      };
    })()`);
    if (!confirmationState.named || !confirmationState.described || !confirmationState.safeFocus || !confirmationState.scrollLocked)
      failures.push(`問題管理: 確認ダイアログの名前・説明・安全側初期フォーカス・背景固定が不足しています。${JSON.stringify(confirmationState)}`);
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor(client, `!document.querySelector('[role="alertdialog"]')`, "Escapeによる確認取消");
    await delay(150);
    const confirmationClosed = await evaluate(
      client,
      `(() => ({ restored: document.activeElement?.classList.contains('delete-button') ?? false, tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim(), classes: document.activeElement?.className, overflow: document.body.style.overflow }))()`,
    );
    if (!confirmationClosed.restored || confirmationClosed.overflow === "hidden")
      failures.push(`問題管理: 取消後のフォーカス復帰または背景スクロール復旧に失敗しました。${JSON.stringify(confirmationClosed)}`);
    reports.push(await evaluate(client, auditExpression("問題管理")));
    await client.send("Page.navigate", {
      url: `${origin}${BASE_PATH}?screen=backupCenter`,
    });
    await waitFor(
      client,
      `document.querySelector("main h1")?.textContent?.trim() === "完全バックアップ"`,
      "PWAショートカットからのバックアップ画面",
    );
    await waitFor(
      client,
      `document.querySelector(".storage-health-badge")?.textContent?.trim() === "正常"`,
      "端末内データ健全性チェック",
    );
    await waitFor(
      client,
      `Boolean(document.querySelector("#storage-persistence-heading"))`,
      "端末データ保持状態の表示",
    );
    const backupExportEnabled = await evaluate(
      client,
      `[...document.querySelectorAll("button")].some((button) => button.textContent?.includes("完全バックアップを出力") && !button.disabled)`,
    );
    if (!backupExportEnabled)
      failures.push("完全バックアップ: 健全性確認後も出力操作が有効になりません。");
    await evaluate(client, `(() => {
      const input = document.querySelector('input[type="file"]');
      if (!input) return false;
      const backup = {
        format: "study-quiz-full-backup",
        version: 8,
        appVersion: "e2e",
        exportedAt: "2026-10-06T00:00:00.000Z",
        entries: { "study-quiz-schema-version": "8" },
      };
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(backup)], "restore.json", { type: "application/json" }));
      Object.defineProperty(input, "files", { value: transfer.files, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      client,
      `Boolean(document.querySelector('[aria-label="現在データとの差分集計"]'))`,
      "復元候補と現在データの差分表示",
    );
    const restoreGuard = await evaluate(
      client,
      `(() => {
        const checkbox = document.querySelector('.backup-restore-confirmation input[type="checkbox"]');
        const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("確認した内容で復元"));
        if (!checkbox || !button || !button.disabled) return false;
        checkbox.click();
        return !button.disabled && Boolean(document.querySelector('.backup-change-badge'));
      })()`,
    );
    if (!restoreGuard)
      failures.push("完全バックアップ: 差分表示または明示確認による復元ガードを確認できません。");
    reports.push(await evaluate(client, auditExpression("完全バックアップ")));
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 393,
      height: 852,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await clickNavigation(client, "その他");
    await waitFor(client, `document.querySelector("main h1")?.textContent?.trim() === "その他"`, "その他画面");
    await clickButton(client, "設定");
    await waitFor(client, `document.querySelector("main h1")?.textContent?.trim() === "学習設定"`, "iPhone幅の設定画面");
    await delay(900);
    await evaluate(client, `(() => { document.querySelector('.guide-close')?.click(); document.querySelector('.theme-picker')?.scrollIntoView({ block: 'start', behavior: 'instant' }); return true; })()`);
    await delay(120);
    await captureScreenshot(client, "03-theme-picker-393");
    const multiSelectLayout = await evaluate(
      client,
      `(() => {
        const groups = [...document.querySelectorAll('.horizontal-option-scroller')];
        const labels = [...document.querySelectorAll('.horizontal-option-fieldset label')];
        const clickLabel = (text) => {
          const label = labels.find((item) => item.textContent?.trim() === text);
          label?.querySelector('input')?.click();
          return Boolean(label);
        };
        const clicked = ['未学習', '学習中', '未回答', '復習期限'].every(clickLabel);
        const selectedByLegend = [...document.querySelectorAll('.horizontal-option-fieldset')].map((fieldset) => ({
          legend: fieldset.querySelector('legend')?.textContent ?? '',
          checked: [...fieldset.querySelectorAll('input:checked')].map((input) => input.parentElement?.textContent?.trim()),
        }));
        return {
          count: groups.length,
          horizontal: groups.every((group) => getComputedStyle(group).overflowX === 'auto' && getComputedStyle(group).flexWrap === 'nowrap'),
          hasOverflow: groups.some((group) => group.scrollWidth > group.clientWidth),
          clicked,
          selectedByLegend,
        };
      })()`,
    );
    if (multiSelectLayout.count !== 3 || !multiSelectLayout.horizontal || !multiSelectLayout.hasOverflow)
      failures.push("学習設定（393px）: 複数選択欄が横スクロール表示になっていません。");
    const masteryGroup = multiSelectLayout.selectedByLegend.find((item) => item.legend.startsWith("理解度"));
    const modeGroup = multiSelectLayout.selectedByLegend.find((item) => item.legend.startsWith("出題方法"));
    if (!multiSelectLayout.clicked || masteryGroup?.checked?.length !== 2 || modeGroup?.checked?.length !== 3)
      failures.push("学習設定（393px）: 理解度または出題方法を複数選択できません。");
    reports.push(await evaluate(client, auditExpression("学習設定（393px）")));
    const dateInputFits = await evaluate(
      client,
      `(() => { const input = document.querySelector('input[type="date"]'); if (!input) return false; const rect = input.getBoundingClientRect(); return rect.left >= 0 && rect.right <= document.documentElement.clientWidth + 1; })()`,
    );
    if (!dateInputFits) failures.push("学習設定（393px）: 試験日入力が画面幅からはみ出しています。");
    const chromeBehavior = await evaluate(
      client,
      `(async () => { window.scrollTo(0, document.documentElement.scrollHeight); await new Promise((resolve) => setTimeout(resolve, 120)); const header = document.querySelector('.app-status-bar'); const bottom = document.querySelector('.bottom-navigation'); return { headerFixed: Boolean(header && getComputedStyle(header).position === 'fixed' && header.getBoundingClientRect().top <= 1), bottomFixed: Boolean(bottom && getComputedStyle(bottom).position === 'fixed') }; })()`,
    );
    if (!chromeBehavior.headerFixed) failures.push("上部ステータスがスクロール後に画面上部へ固定されていません。");
    if (!chromeBehavior.bottomFixed) failures.push("下部ナビゲーションが固定表示ではありません。");
    await evaluate(client, "window.scrollTo(0, 0); true");
    await evaluate(client, "document.activeElement?.blur(); document.body.focus(); true");
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    const keyboardFocus = await evaluate(client, `document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement`);
    if (!keyboardFocus) failures.push("キーボード操作: Tabキーでフォーカス可能要素へ移動できません。");
    const accessibilityTree = await client.send("Accessibility.getFullAXTree");
    const unnamedControls = (accessibilityTree.nodes ?? []).filter((node) => {
      const role = node.role?.value;
      return !node.ignored && ["button", "link", "textbox", "combobox"].includes(role) && !node.name?.value?.trim();
    });
    if (unnamedControls.length) failures.push(`アクセシビリティツリー: 名前のない操作要素が${unnamedControls.length}件あります。`);
    for (const report of reports) {
      for (const issue of report.issues) failures.push(`${report.screenName}: ${issue}`);
    }
    if (failures.length) {
      throw new Error(`E2Eアクセシビリティ試験で${failures.length}件の問題を検出しました。\n${failures.map((item) => `- ${item}`).join("\n")}`);
    }
    console.log(`E2E試験に成功しました（3回答方式の登録・回答・履歴・バックアップ往復、${reports.length}画面、${themeReports.length}テーマ組合せ、320x568・393x852、主要ナビゲーション、確認ダイアログ、コントラスト、横スクロール複数選択、固定表示、入力エラー、キーボード、AXツリー）。`);
  } finally {
    try {
      await client?.send("Browser.close");
    } catch {
      // 試験中にブラウザが終了している場合は、そのまま後始末へ進む。
    }
    client?.close();
    if (browser.exitCode === null) browser.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => browser.once("exit", resolveExit)),
      delay(3000),
    ]);
    server.closeAllConnections();
    await new Promise((resolveClose) => server.close(resolveClose));
    await rm(profileDirectory, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 100,
    });
    await rm(downloadDirectory, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 100,
    });
  }
};
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

