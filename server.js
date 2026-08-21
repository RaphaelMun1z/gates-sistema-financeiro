"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const PUBLIC_PATHS = new Set(["/", "/index.html"]);
const PUBLIC_PREFIXES = ["/assets/", "/src/"];

function publicPathname(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.includes("\0")) return null;

  const normalized = path.posix.normalize(decoded);
  if (normalized === ".." || normalized.startsWith("../")) return null;
  if (PUBLIC_PATHS.has(normalized) || PUBLIC_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return normalized;
  }
  return null;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
  const requestedPath = publicPathname(url.pathname);
  if (!requestedPath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  const publicFile = requestedPath === "/" ? "/index.html" : requestedPath;
  const filePath = path.resolve(root, `.${publicFile}`);

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(file);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
  }
}

const server = http.createServer((request, response) => {
  serveStatic(request, response).catch(() => {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  });
});

server.listen(port, host, () => {
  console.log(`Gates disponível em http://${host}:${port}`);
});
