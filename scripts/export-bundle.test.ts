import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseBundle } from "@/lib/content/parse-bundle";
import { treeToFiles } from "@/lib/content/serialize";
import { diskPath } from "@/lib/content/load";
import { main } from "./export-bundle";
import { planImport } from "./import-bundle";

const SEED_FILE = "seed/crypto-finance-the-tie.skilltree.md";
const seed = fs.readFileSync(path.join(process.cwd(), SEED_FILE), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-export-"));
beforeAll(() => {
  // main() reports to stderr; keep test output quiet.
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("content:bundle", () => {
  it("exports the imported tree as a bundle that parses back cleanly", () => {
    const dir = path.join(tmp, "content");
    const { tree } = planImport(seed, SEED_FILE);
    for (const f of treeToFiles(tree)) {
      fs.mkdirSync(path.dirname(diskPath(f.path, dir)), { recursive: true });
      fs.writeFileSync(diskPath(f.path, dir), f.text);
    }
    const out = path.join(tmp, "export.skilltree.md");
    expect(main(["--dir", dir, "--out", out, "--pack", "seed-crypto-finance-the-tie"])).toBe(0);
    const back = parseBundle(fs.readFileSync(out, "utf8"), out);
    expect(back.diagnostics).toEqual([]);
    expect(back.branches.map((b) => b.id)).toEqual(["swe", "finance", "crypto"]);
    expect(back.skills).toHaveLength(24);
    expect(back.packs[0].id).toBe("seed-crypto-finance-the-tie");
    expect(back.packs[0].body).toContain("## Review log");
    expect(main(["--dir", dir, "--pack", "nope"])).toBe(1);
  });

  it("rejects an option without a value and a --dir that doesn't exist", () => {
    const cwd = process.cwd();
    process.chdir(tmp);
    try {
      expect(main(["--dir", path.join(tmp, "content"), "--out", "--pack", "seed-crypto-finance-the-tie"])).toBe(2);
      expect(fs.existsSync(path.join(tmp, "--pack"))).toBe(false);
    } finally {
      process.chdir(cwd);
    }
    expect(main(["--dir", path.join(tmp, "nope")])).toBe(2);
  });
});
