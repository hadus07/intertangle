import { afterAll, describe, expect, it } from "vitest";
import { buildGraph } from "../src/buildGraph.js";
import { startServer } from "../src/server.js";
import { fixtureRoot } from "./helpers.js";

const root = fixtureRoot("relative-imports");
const builtAssets = new URL("../dist/web/", import.meta.url);

describe("server", () => {
  let handle: Awaited<ReturnType<typeof startServer>>;

  it("serves /graph matching buildGraph", async () => {
    const graph = await buildGraph(root);
    handle = await startServer(graph, builtAssets);

    const res = await fetch(`http://127.0.0.1:${handle.port}/graph`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual(graph);
  });

  it("serves the prebuilt frontend", async () => {
    // Server tests rely on a prior build; verify the asset exists.
    const res = await fetch(`http://127.0.0.1:${handle.port}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  afterAll(async () => {
    await handle?.close();
  });
});
