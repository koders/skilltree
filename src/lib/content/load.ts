// Reads content/ from disk (node fs). Usable from scripts and server code; the
// Next app goes through `getContent()` in server.ts.

import fs from "node:fs";
import path from "node:path";
import { type ContentFile, compareStrings, parseTreeFiles } from "@/lib/content/parse-tree";
import type { ContentTree } from "@/lib/content/types";

export const CONTENT_ROOT = "content";

export function defaultContentDir(): string {
  return path.join(process.cwd(), CONTENT_ROOT);
}

function walk(dir: string, rel: string, out: string[]): void {
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) walk(dir, child, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(child);
  }
}

/**
 * Every `.md` file under `dir`, with paths reported as `content/…` whatever
 * the directory is called, so ids and paths line up (spec §1). A missing
 * directory reads as empty.
 */
export function readContentFiles(dir: string = defaultContentDir()): ContentFile[] {
  if (!fs.existsSync(dir)) return [];
  const rels: string[] = [];
  walk(dir, "", rels);
  return rels.sort(compareStrings).map((rel) => ({
    path: `${CONTENT_ROOT}/${rel}`,
    text: fs.readFileSync(path.join(dir, rel), "utf8"),
  }));
}

/** Where a `content/…` path lives on disk when content/ is `dir`. */
export function diskPath(contentPath: string, dir: string = defaultContentDir()): string {
  const rel = contentPath.replace(/\\/g, "/").replace(new RegExp(`^${CONTENT_ROOT}/`), "");
  return path.join(dir, ...rel.split("/"));
}

export function loadContentTree(dir?: string): ContentTree {
  return parseTreeFiles(readContentFiles(dir));
}
