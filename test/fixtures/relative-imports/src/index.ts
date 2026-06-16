import { makeWidget } from "./utils";
import type { Widget } from "./types";

export function run(): Widget {
  return makeWidget("hello");
}
