import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readContentFiles } from "@/lib/content/load";
import { applyIds, findMissingIds, main } from "./content-ids";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-ids-"));
beforeAll(() => {
  // main() reports to stderr; keep test output quiet.
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const SKILL = `# Skill
- id: a.skill
- requires: —

## Rank 1
- [ ] [read] Existing — ~10 min {#existing}
- [ ] [read] New reading   
  - Do: keep this line as is.

## Recall
- Old? {#q3}
- New?
`;

function setup() {
  fs.mkdirSync(path.join(dir, "branches/a"), { recursive: true });
  fs.writeFileSync(path.join(dir, "branches/a/_branch.md"), "# A\n- id: a\n");
  fs.writeFileSync(path.join(dir, "branches/a/skill.md"), SKILL);
}

describe("content:ids", () => {
  it("finds missing item and recall ids with their lines", () => {
    setup();
    expect(findMissingIds(readContentFiles(dir))).toEqual([
      { path: "content/branches/a/skill.md", line: 7, id: "new-reading", what: "item" },
      { path: "content/branches/a/skill.md", line: 12, id: "q4", what: "recall" },
    ]);
  });

  it("appends ids to the exact lines only", () => {
    expect(applyIds("a\nb  \nc", [{ path: "", line: 2, id: "x", what: "item" }])).toBe("a\nb {#x}\nc");
  });

  it("keeps a file's CRLF line endings", () => {
    expect(applyIds("a\r\nb\r\nc\r\n", [{ path: "", line: 2, id: "x", what: "item" }])).toBe("a\r\nb {#x}\r\nc\r\n");
  });

  it("--check exits 1 and leaves files alone; a normal run fixes them", () => {
    setup();
    expect(main(["--check", "--dir", dir])).toBe(1);
    expect(fs.readFileSync(path.join(dir, "branches/a/skill.md"), "utf8")).toBe(SKILL);
    expect(main(["--dir", dir])).toBe(0);
    const fixed = fs.readFileSync(path.join(dir, "branches/a/skill.md"), "utf8");
    expect(fixed).toBe(SKILL.replace("- [ ] [read] New reading   ", "- [ ] [read] New reading {#new-reading}").replace("- New?", "- New? {#q4}"));
    expect(main(["--check", "--dir", dir])).toBe(0);
  });

  it("fails instead of checking nothing when --dir is missing or wrong", () => {
    expect(main(["--check", "--dir", path.join(dir, "nope")])).toBe(2);
    expect(main(["--dir", "--check"])).toBe(2);
  });
});
