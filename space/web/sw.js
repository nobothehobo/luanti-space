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
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
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
  // Network first picks up new cloud builds; a validated precache allows offline launch.
  event.respondWith(
    fetch(event.request).catch(() =>
      caches
        .open(CACHE)
        .then((cache) => cache.match(event.request, { ignoreSearch: true }))
        .then((response) => response || Response.error()),
    ),
  );
});
