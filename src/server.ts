import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Graph } from "./shared/graph.js";

const defaultAssetsUrl = new URL("./web/", import.meta.url);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export interface ServerHandle {
  port: number;
  close(): Promise<void>;
}

export function startServer(
  graph: Graph,
  assetsUrl: URL = defaultAssetsUrl,
): Promise<ServerHandle> {
  const webRoot = fileURLToPath(assetsUrl);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/graph" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(graph));
      return;
    }

    const rawPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const safePath = path.normalize(rawPath).replace(/^\/(\.\.)+/, "/");
    const target = path.resolve(webRoot, safePath.startsWith("/") ? safePath.slice(1) : safePath);
    const isInside =
      target === path.resolve(webRoot) || target.startsWith(path.resolve(webRoot) + path.sep);

    if (!isInside) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const data = await fs.readFile(target);
      const ext = path.extname(target);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      try {
        const fallback = await fs.readFile(new URL("index.html", assetsUrl));
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(fallback);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        port,
        close: () =>
          new Promise<void>((res, rej) => {
            server.closeAllConnections?.();
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}
