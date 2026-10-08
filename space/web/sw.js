// SPDX-License-Identifier: LGPL-2.1-or-later
// Only cache this game's paths, never unrelated repositories on the same origin.
const CACHE = "space-browser-v1-1";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "world_spec.json",
  "build-info.json",
  "src/app.js",
  "src/world.js",
  "src/flight.js",
  "src/input.js",
  "src/renderer.js",
  "src/save.js",
  "src/ship.js",
  "src/exploration.js",
];
const SHELL_PATHS = new Set(
  FILES.map((file) => new URL(file, self.registration.scope).pathname),
);
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          FILES.map((file) =>
            new Request(new URL(file, self.registration.scope), {
              cache: "reload",
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("space-browser-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  if (!SHELL_PATHS.has(url.pathname)) return;
  // A complete versioned shell starts immediately, even if WebKit takes a long
  // time to reject an unavailable connection. New builds install a fresh cache
  // through the browser's service-worker update check; never mix network files
  // from a partially propagated deployment into this cached shell.
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(event.request, { ignoreSearch: true }))
      .then((response) => response || fetch(event.request)),
  );
});
