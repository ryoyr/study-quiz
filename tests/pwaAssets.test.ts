import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readPngSize = (path: string): { width: number; height: number } => {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

test("manifestが参照するPWAアイコンが正しい寸法で存在する", () => {
  const manifest = JSON.parse(
    readFileSync("public/manifest.webmanifest", "utf8"),
  ) as {
    icons: Array<{ src: string; sizes: string }>;
  };

  for (const icon of manifest.icons) {
    const expected = Number(icon.sizes.split("x")[0]);
    const size = readPngSize(`public/${icon.src}`);
    assert.deepEqual(size, { width: expected, height: expected });
  }
  assert.equal((manifest as { id?: string }).id, "./");
  assert.ok(
    (manifest as { shortcuts?: Array<{ url: string }> }).shortcuts?.some(
      (shortcut) => shortcut.url === "./?screen=backupCenter",
    ),
  );
});

test("iOS用アイコンとService Workerのプリキャッシュ対象が存在する", () => {
  assert.deepEqual(readPngSize("public/apple-touch-icon.png"), {
    width: 180,
    height: 180,
  });
  const worker = readFileSync("public/sw.js", "utf8");
  for (const asset of [
    "apple-touch-icon.png",
    "pwa-192x192.png",
    "pwa-512x512.png",
    "pwa-maskable-512x512.png",
  ]) {
    assert.match(worker, new RegExp(asset.replaceAll(".", "\\.")));
    readFileSync(`public/${asset}`);
  }
  assert.match(worker, /matchAll/);
  assert.match(worker, /js\|css/);
});

test("Service Workerのキャッシュ世代はv4.5.0配布版へ更新されている", () => {
  const serviceWorker = readFileSync("public/sw.js", "utf8");
  assert.match(serviceWorker, /study-quiz-shell-/);
  assert.match(serviceWorker, /CACHE_NAME = `\$\{CACHE_PREFIX\}v20`/);
  assert.match(serviceWorker, /Promise\.allSettled/);
  assert.match(serviceWorker, /request\.headers\.has\("range"\)/);
  assert.match(serviceWorker, /navigationPreload/);
  assert.match(serviceWorker, /Promise\.resolve\(preloadResponse\)\.catch/);
  assert.match(serviceWorker, /Cache Storageへの保存はベストエフォート/);
});

