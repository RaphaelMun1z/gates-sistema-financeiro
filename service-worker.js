"use strict";

const CACHE_NAME = "gates-pwa-v1";
const APP_SHELL = [
  "./", "./index.html", "./manifest.json",
  "./assets/favicon.svg", "./assets/icon-192.svg", "./assets/icon-512.svg",
  "./src/styles/styles.css", "./src/scripts/app.js",
  "./src/scripts/account-utils.js", "./src/scripts/date-utils.js",
  "./src/scripts/pdf-parser.js", "./src/scripts/pwa.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const externalAsset = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname);
  if (!sameOrigin && !externalAsset) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((response) => {
      if (response.ok || response.type === "opaque") {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      }
      return response;
    });
  }));
});
