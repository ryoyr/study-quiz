const CACHE_PREFIX = "study-quiz-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v20`;
const BASE_URL = new URL("./", self.registration.scope);
const CORE_SHELL = ["./", "./index.html", "./manifest.webmanifest"].map(
  (path) => new URL(path, BASE_URL).href,
);
const OPTIONAL_SHELL = [
  "./apple-touch-icon.png",
  "./pwa-192x192.png",
  "./pwa-512x512.png",
  "./pwa-maskable-512x512.png",
].map((path) => new URL(path, BASE_URL).href);

const cacheResponse = async (cache, request, response) => {
  if (
    response.ok &&
    response.type !== "opaque" &&
    response.status !== 206
  ) {
    // キャッシュ容量不足でも、取得済みのネットワーク応答は利用者へ返す。
    try {
      await cache.put(request, response.clone());
    } catch {
      // Cache Storageへの保存はベストエフォートとする。
    }
  }
  return response;
};

const precacheAppShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(CORE_SHELL);

  // アイコン欠落だけでService Worker全体のインストールを失敗させない。
  await Promise.allSettled(
    OPTIONAL_SHELL.map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`Optional asset failed: ${url}`);
      await cache.put(url, response);
    }),
  );

  // Viteが生成したハッシュ付きJS/CSSを初回インストール時に保存する。
  const indexUrl = new URL("./index.html", BASE_URL).href;
  const indexResponse = await cache.match(indexUrl);
  if (!indexResponse) throw new Error("App Shellを取得できませんでした。");
  const html = await indexResponse.text();
  const assetUrls = [
    ...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/giu),
  ].map((match) => new URL(match[1], indexUrl).href);
  await cache.addAll([...new Set(assetUrls)]);
};

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
      self.registration.navigationPreload?.enable?.().catch(() => undefined) ??
        Promise.resolve(),
    ]).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

const fetchWithTimeout = async (request, milliseconds = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const networkFirstNavigation = async (request, preloadResponse) => {
  const cache = await caches.open(CACHE_NAME);
  try {
    const preloaded = await Promise.resolve(preloadResponse).catch(() => undefined);
    const response = preloaded ?? (await fetchWithTimeout(request));
    await cacheResponse(cache, request, response);
    return response;
  } catch {
    return (
      (await cache.match(request)) ??
      (await cache.match(new URL("./index.html", BASE_URL).href)) ??
      Response.error()
    );
  }
};

const cacheFirstAsset = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const cache = await caches.open(CACHE_NAME);
    return await cacheResponse(cache, request, await fetch(request));
  } catch {
    return Response.error();
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE_URL.pathname)
  ) {
    return;
  }

  event.respondWith(
    request.mode === "navigate"
      ? networkFirstNavigation(request, event.preloadResponse)
      : cacheFirstAsset(request),
  );
});

