// pnpm content:bundle [--out file] [--pack <pack-id>] [--dir content]
//
// Writes the whole tree as one *.skilltree.md bundle (spec §8), e.g. for a
// review round. With --pack, that pack's frontmatter and notes frame the
// bundle; otherwise a minimal frontmatter is generated.

import fs from "node:fs";
import path from "node:path";
import { defaultContentDir, loadContentTree } from "@/lib/content/load";
import { serializeBundle } from "@/lib/content/serialize";

function log(line = ""): void {
  process.stderr.write(`${line}\n`);
}

function option(argv: string[], name: string): string | null {
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1] ?? null;
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

/** An option given without a value (`--out --pack x`) would otherwise take the next flag as its value. */
function missingValue(argv: string[]): string | null {
  return (
    ["--out", "--pack", "--dir"].find((name) => {
      const i = argv.indexOf(name);
      return i >= 0 && (argv[i + 1] === undefined || argv[i + 1].startsWith("--"));
    }) ?? null
  );
}

export function main(argv: string[]): number {
  const missing = missingValue(argv);
  if (missing !== null) {
    log(`${missing} needs a value. Usage: pnpm content:bundle [--out file] [--pack <pack-id>] [--dir content]`);
    return 2;
  }
  const dirOpt = option(argv, "--dir");
  const dir = dirOpt ? path.resolve(dirOpt) : defaultContentDir();
  if (dirOpt && !fs.existsSync(dir)) {
    log(`No content directory at ${dir}.`);
    return 2;
  }
  const tree = loadContentTree(dir);
  const packId = option(argv, "--pack");
  const pack = packId === null ? undefined : tree.packs.find((p) => p.id === packId);
  if (packId !== null && !pack) {
    log(`No pack "${packId}" in ${dir}. Packs: ${tree.packs.map((p) => p.id).join(", ") || "none"}.`);
    return 1;
  }
  if (tree.diagnostics.length) log(`Warning: ${tree.diagnostics.length} parse diagnostic(s); run pnpm validate.`);

  const text = serializeBundle(tree, pack);
  const out = option(argv, "--out");
  if (out === null) {
    process.stdout.write(text);
  } else {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, text);
    log(`Wrote ${tree.branches.length} branches, ${tree.skills.length} skills, ${tree.quests.length} quest(s) to ${out}`);
  }
  return 0;
}

if (process.argv[1] && /export-bundle\.ts$/.test(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
