// pnpm content:ids [--check] [--dir content]
//
// Adds missing `{#id}`s to items and recall questions in content/ (spec §2.4,
// §2.6). Ids are appended to the exact source lines, so the rest of each file
// keeps its formatting. --check only reports and exits 1 if any are missing.

import fs from "node:fs";
import path from "node:path";
import { assignMissingIds } from "@/lib/content/ids";
import { defaultContentDir, diskPath, readContentFiles } from "@/lib/content/load";
import { type ContentFile, parseTreeFiles } from "@/lib/content/parse-tree";
import { normalizeNewlines } from "@/lib/content/markdown";

export interface IdInsertion {
  path: string;
  line: number;
  id: string;
  what: "item" | "recall";
}

/** Ids to add, found by pairing each file's AST with its id-filled copy. */
export function findMissingIds(files: ContentFile[]): IdInsertion[] {
  const tree = parseTreeFiles(files);
  const filled = assignMissingIds(tree);
  const out: IdInsertion[] = [];
  tree.skills.forEach((skill, si) => {
    const after = filled.skills[si];
    skill.ranks.forEach((rank, ri) =>
      rank.items.forEach((item, ii) => {
        if (item.id === "") out.push({ path: skill.file, line: item.line, id: after.ranks[ri].items[ii].id, what: "item" });
      }),
    );
    skill.recall.forEach((q, qi) => {
      if (q.id === "") out.push({ path: skill.file, line: q.line, id: after.recall[qi].id, what: "recall" });
    });
  });
  tree.quests.forEach((quest, qi) => {
    quest.maintenance?.items.forEach((item, ii) => {
      const id = filled.quests[qi].maintenance?.items[ii].id ?? "";
      if (item.id === "") out.push({ path: quest.file, line: item.line, id, what: "item" });
    });
  });
  return out;
}

/** Appends ` {#id}` to each listed line; the id belongs at the end of the item/question line. */
export function applyIds(text: string, insertions: IdInsertion[]): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = normalizeNewlines(text).split("\n");
  for (const ins of insertions) lines[ins.line - 1] = `${lines[ins.line - 1].trimEnd()} {#${ins.id}}`;
  return lines.join(eol);
}

function log(line = ""): void {
  process.stderr.write(`${line}\n`);
}

export function main(argv: string[]): number {
  const check = argv.includes("--check");
  const dirFlag = argv.indexOf("--dir");
  const dirArg = dirFlag >= 0 ? argv[dirFlag + 1] : undefined;
  if (dirFlag >= 0 && (dirArg === undefined || dirArg.startsWith("--"))) {
    log("Usage: pnpm content:ids [--check] [--dir content]");
    return 2;
  }
  const dir = dirArg === undefined ? defaultContentDir() : path.resolve(dirArg);
  // A mistyped --dir would otherwise "pass" by checking zero files.
  if (dirArg !== undefined && !fs.existsSync(dir)) {
    log(`No content directory at ${dir}.`);
    return 2;
  }
  const files = readContentFiles(dir);
  const missing = findMissingIds(files);
  if (missing.length === 0) {
    log(`All items and recall questions in ${files.length} file(s) have ids.`);
    return 0;
  }

  const byFile = new Map<string, IdInsertion[]>();
  for (const m of missing) byFile.set(m.path, [...(byFile.get(m.path) ?? []), m]);
  if (check) {
    log(`${missing.length} missing id(s) in ${byFile.size} file(s); run pnpm content:ids to add them:`);
    missing.forEach((m) => log(`  ${m.path}:${m.line} ${m.what} → {#${m.id}}`));
    return 1;
  }

  for (const [file, insertions] of byFile) {
    const text = files.find((f) => f.path === file)?.text ?? "";
    fs.writeFileSync(diskPath(file, dir), applyIds(text, insertions));
    log(`  ${file}: ${insertions.map((i) => `{#${i.id}}`).join(" ")}`);
  }
  log(`Added ${missing.length} id(s) in ${byFile.size} file(s).`);
  return 0;
}

if (process.argv[1] && /content-ids\.ts$/.test(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
