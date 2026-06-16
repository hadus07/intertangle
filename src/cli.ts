import path from "node:path";
import process from "node:process";
import open from "open";
import { buildGraph } from "./buildGraph.js";
import { startServer } from "./server.js";

async function main() {
  const cwd = process.cwd();
  const args = process.argv.slice(2);

  const graph = await buildGraph(cwd);

  const seeds = args
    .map((arg) => path.relative(cwd, path.resolve(cwd, arg)))
    .map((p) => p.replaceAll("\\", "/"))
    .filter((p) => !p.startsWith("../") && p.length > 0);

  const validSeeds = seeds.filter((p) => graph.nodes[p]);
  const missing = seeds.filter((p) => !graph.nodes[p]);
  for (const p of missing) {
    console.warn(`Warning: seed not found in graph: ${p}`);
  }

  const { port, close } = await startServer(graph);

  const params = new URLSearchParams();
  if (validSeeds.length > 0) {
    params.set("seeds", validSeeds.join(","));
  }

  const url = `http://127.0.0.1:${port}/${params.toString() ? `?${params.toString()}` : ""}`;
  console.log(`interweave running at ${url}`);
  await open(url);

  const shutdown = async () => {
    await close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
