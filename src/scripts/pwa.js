"use strict";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(() => {
      // O app continua funcionando quando o ambiente não permite PWA.
    });
  });
}
