import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { diskPath, loadContentTree, readContentFiles } from "@/lib/content/load";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-load-"));
const write = (rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
write("branches/a/_branch.md", "# A\n- id: a\n");
write("branches/a/one.md", "# One\n- id: a.one\n- requires: —\n");
write("quests/q.md", "# Q\n- id: quest-q\n\n| Weeks | Stage | Skills |\n| --- | --- | --- |\n| 1 | One | a.one |\n");
write("packs/p.md", "---\nid: p\n---\n\nBody.\n");
write(".hidden/x.md", "# hidden");
write("branches/a/notes.txt", "not markdown");

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("readContentFiles", () => {
  it("returns sorted content/… paths for every .md file", () => {
    expect(readContentFiles(dir).map((f) => f.path)).toEqual([
      "content/branches/a/_branch.md",
      "content/branches/a/one.md",
      "content/packs/p.md",
      "content/quests/q.md",
    ]);
  });

  it("reads a missing directory as empty", () => {
    expect(readContentFiles(path.join(dir, "nope"))).toEqual([]);
  });

  it("maps content/ paths back to disk", () => {
    expect(diskPath("content/branches/a/one.md", dir)).toBe(path.join(dir, "branches", "a", "one.md"));
  });
});

describe("loadContentTree", () => {
  it("parses the directory in tree shape", () => {
    const tree = loadContentTree(dir);
    expect(tree.shape).toBe("tree");
    expect(tree.diagnostics).toEqual([]);
    expect(tree.branches.map((b) => [b.id, b.skillIds])).toEqual([["a", ["a.one"]]]);
    expect(tree.skills[0].file).toBe("content/branches/a/one.md");
    expect(tree.quests.map((q) => q.id)).toEqual(["quest-q"]);
    expect(tree.packs.map((p) => [p.id, p.body])).toEqual([["p", "Body."]]);
  });
});
