import fs from "node:fs";
import React from "react";
import { id } from "./utils";

export function init() {
  const data = id(fs.existsSync("."));
  return React.createElement("div", null, String(data));
}
