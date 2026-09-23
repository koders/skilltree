// Entry point for `pnpm validate`. All logic lives in validate-cli.ts; this
// file only wires in the real parser, loader and process streams.

import fs from "node:fs";
import { loadContentTree } from "@/lib/content/load";
import { parseBundle } from "@/lib/content/parse-bundle";
import { runValidateCli } from "./validate-cli";

process.exitCode = runValidateCli(process.argv.slice(2), {
  loadTree: (dir) => loadContentTree(dir),
  parseBundleFile: (file) => parseBundle(fs.readFileSync(file, "utf8"), file),
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
  isTTY: Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined,
});
