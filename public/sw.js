

const CACHE_PREFIX = "study-quiz-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v9`;
const BASE_URL = new URL("./", self.registration.scope);
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./pwa-192x192.png",
  "./pwa-512x512.png",
  "./pwa-maskable-512x512.png",
].map((path) => new URL(path, BASE_URL).href);

const precacheAppShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);

  // Viteが生成したハッシュ付きJS/CSSも、初回インストール時に確実に保存する。
  const indexUrl = new URL("./index.html", BASE_URL).href;
  const indexResponse = await cache.match(indexUrl);
  if (!indexResponse) throw new Error("App Shellを取得できませんでした。");
  const html = await indexResponse.text();
  const assetUrls = [
    ...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/giu),
  ].map((match) => new URL(match[1], BASE_URL).href);
  await cache.addAll([...new Set(assetUrls)]);
};

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

const cacheSuccessfulResponse = async (request, response) => {
  if (!response.ok || response.type === "opaque") return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
};

const fetchWithTimeout = async (request, milliseconds = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE_URL.pathname)
  )
    return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetchWithTimeout(request)
        .then((response) => cacheSuccessfulResponse(request, response))
        .catch(
          async () =>
            (await caches.match(request)) ??
            (await caches.match(new URL("./index.html", BASE_URL).href)) ??
            Response.error(),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      try {
        return await cacheSuccessfulResponse(request, await fetch(request));
      } catch {
        return Response.error();
      }
    }),
  );
});

