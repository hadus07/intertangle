import path from "node:path";
import { cruise, type ICruiseOptions } from "dependency-cruiser";
import type { Graph, GraphNode } from "./shared/graph.js";

const LOCAL_TYPES = new Set(["local", "localmodule"]);
const EXTERNAL_TYPES = new Set([
  "npm",
  "npm-dev",
  "npm-optional",
  "npm-peer",
  "npm-no-pkg",
  "core",
  "unresolved",
  "unknown",
  "aliased",
  "aliased-tsconfig",
  "aliased-webpack",
  "aliased-babel",
  "aliased-subpath",
]);

export async function buildGraph(root: string): Promise<Graph> {
  const options: ICruiseOptions = {
    baseDir: root,
    outputType: "json",
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "core"],
    },
    exclude: "^(node_modules|dist|\\.git|coverage)$",
    moduleSystems: ["es6", "cjs"],
    combinedDependencies: true,
    tsPreCompilationDeps: true,
  };

  const result = await cruise(["."], options);
  const modules = (JSON.parse(result.output as string) as { modules?: unknown[] }).modules ?? [];

  const graph: Graph = {
    root,
    nodes: {},
    forward: {},
    external: {},
  };

  for (const mod of modules) {
    const raw = (mod as { source?: string }).source;
    if (!raw || typeof raw !== "string") continue;
    const source = toProjectRelative(raw, root);
    if (!source || source.startsWith("../")) continue;

    const node: GraphNode = {
      path: source,
      name: path.posix.basename(source),
    };
    graph.nodes[source] = node;
    graph.forward[source] = [];
    graph.external[source] = [];

    const deps = (mod as { dependencies?: unknown[] }).dependencies ?? [];
    for (const dep of deps) {
      const depModule = (dep as { module?: string }).module ?? "";
      const depResolved = (dep as { resolved?: string }).resolved ?? depModule;
      const types = ((dep as { dependencyTypes?: string[] }).dependencyTypes ?? []).filter(
        (t): t is string => typeof t === "string",
      );

      if (isLocal(types, depResolved, root)) {
        const target = toProjectRelative(depResolved, root);
        if (
          target &&
          target !== source &&
          !target.startsWith("node_modules/") &&
          !target.startsWith("../")
        ) {
          graph.forward[source].push(target);
        }
      } else {
        graph.external[source].push(depModule);
      }
    }

    graph.forward[source] = sortedUnique(graph.forward[source]);
    graph.external[source] = sortedUnique(graph.external[source]);
  }

  return graph;
}

function toProjectRelative(filePath: string, root: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  let relative = path.relative(path.resolve(root), absolute);
  relative = relative.replaceAll("\\", "/");
  if (relative.startsWith("../")) return "";
  return relative;
}

function isLocal(types: string[], resolved: string, root: string): boolean {
  if (types.some((t) => LOCAL_TYPES.has(t))) return true;
  if (types.some((t) => EXTERNAL_TYPES.has(t))) return false;
  // Default to local only if it resolves inside the project and looks like a file path.
  if (!resolved) return false;
  const absolute = path.isAbsolute(resolved) ? resolved : path.resolve(root, resolved);
  const relative = path.relative(path.resolve(root), absolute);
  return !relative.startsWith("..") && !relative.startsWith("node_modules");
}

function sortedUnique<T extends string>(arr: T[]): T[] {
  const set = new Set(arr);
  return [...set].sort() as T[];
}
