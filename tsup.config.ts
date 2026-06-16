import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  outDir: "dist",
  clean: true,
  splitting: false,
  bundle: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
