import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadContentTree } from "@/lib/content/load";
import { planImport } from "./import-bundle";

const SEED_FILE = "seed/crypto-finance-the-tie.skilltree.md";
const seed = fs.readFileSync(path.join(process.cwd(), SEED_FILE), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skilltree-import-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const TSX = path.join(process.cwd(), "node_modules", ".bin", "tsx");
function run(args: string[]): { code: number; stderr: string } {
  try {
    execFileSync(TSX, ["scripts/import-bundle.ts", ...args], { cwd: process.cwd(), stdio: "pipe", encoding: "utf8" });
    return { code: 0, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stderr?: string };
    return { code: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

describe("planImport", () => {
  const { tree, files, report } = planImport(seed, SEED_FILE);
  const skill = (id: string) => tree.skills.find((s) => s.id === id)!;

  it("reports counts and generated ids", () => {
    expect(report).toMatchObject({
      branches: 3,
      skills: 24,
      quests: 1,
      items: 75,
      recall: 57,
      generatedItemIds: 75,
      generatedRecallIds: 57,
      factsAsOf: "2026-09-23",
      errors: [],
    });
    expect(files).toHaveLength(29);
  });

  it("stamps facts_as_of only on skills with time-sensitive items", () => {
    expect(report.stampedFactsAsOf).toEqual([
      "finance.institutions",
      "finance.regulation",
      "crypto.ethereum-staking",
      "crypto.solana-staking",
      "crypto.cosmos-staking",
    ]);
    expect(skill("swe.react").factsAsOf).toBeNull();
    expect(skill("crypto.consensus").factsAsOf).toBeNull();
    expect(files.find((f) => f.path === "content/branches/swe/react.md")?.text).not.toContain("facts_as_of");
  });

  it("keeps the bundle's branch order", () => {
    expect(report.stampedOrder).toEqual([
      { branchId: "swe", order: 1 },
      { branchId: "finance", order: 2 },
      { branchId: "crypto", order: 3 },
    ]);
  });

  it("copies pack sources into skills that link the same URL", () => {
    expect(skill("crypto.consensus").sources).toEqual([
      { title: "Roughgarden: Foundations of Blockchains course page", url: "https://timroughgarden.github.io/fob21/", note: "as of 2026-09-23", line: 0 },
    ]);
    expect(skill("crypto.cosmos-staking").sources.map((s) => s.url)).toEqual([
      "https://www.stakingrewards.com/asset/cosmos",
      "https://forum.cosmos.network/t/tokenomics-idea-n-1/16354",
    ]);
    expect(report.attachedSources).toHaveLength(20);
    expect(report.unattachedSources.map((s) => s.title)).toContain("The Tie homepage — business lines");
    expect(report.unattachedSources).toHaveLength(12);
  });
});

const TABLE = "| Weeks | Stage | Skills |\n| --- | --- | --- |\n| 1 | A | b.s1 |";

describe("planImport hardening", () => {
  it("stamps the bundle date as As of on time-sensitive quest habits, which have no facts_as_of of their own", () => {
    const { tree, files, report } = planImport(
      `---\nid: p\nfacts_as_of: 2026-01-01\n---\n\n# Branch: B\n\n- id: b\n\n## S1\n- id: b.s1\n- requires: —\n\n# Quest: Q\n\n- id: quest-q\n\n${TABLE}\n\n## Maintenance (weekly)\n\n- [ ] [habit] [time-sensitive] Check the rate — ~10 min\n  - Verify: the rate.\n- [ ] [habit] [time-sensitive] Dated — ~10 min\n  - As of: 2025-12-01\n- [ ] [habit] Plain — ~10 min\n`,
      "p.skilltree.md",
    );
    expect(report.errors).toEqual([]);
    const items = tree.quests[0].maintenance?.items ?? [];
    expect(items.map((i) => i.asOf)).toEqual(["2026-01-01", "2025-12-01", null]);
    expect(report.stampedItemAsOf).toEqual(["quest-q/check-the-rate"]);
    expect(files.find((f) => f.path === "content/quests/q.md")?.text).toContain("  - Verify: the rate.\n  - As of: 2026-01-01\n");
  });

  it.each([
    ["a skill id that climbs out of content/", "- id: b.../../../evil"],
    ["a skill slug that would be hidden", "- id: b..hidden"],
    ["a skill slug the loader ignores", "- id: b._draft"],
    ["a skill that would overwrite its branch file", "- id: b._branch"],
    ["a skill id with a nested folder", "- id: b.x/y"],
  ])("refuses %s", (_, idLine) => {
    const { report } = planImport(`---\nid: p\n---\n\n# Branch: B\n\n- id: b\n\n## S1\n${idLine}\n- requires: —\n`, "p.skilltree.md");
    expect(report.errors).toEqual([expect.objectContaining({ severity: "error", line: 9, message: expect.stringMatching(/can't be written/) })]);
  });

  it("refuses duplicate skill ids, which would overwrite each other's file", () => {
    const { report } = planImport(
      `---\nid: p\n---\n\n# Branch: B\n\n- id: b\n\n## S1\n- id: b.s\n- requires: —\n\n## S2\n- id: b.s\n- requires: —\n`,
      "p.skilltree.md",
    );
    expect(report.errors).toEqual([expect.objectContaining({ line: 13, skillId: "b.s", message: expect.stringMatching(/duplicate id/) })]);
  });

  it("refuses a pack id that climbs out of content/", () => {
    const { report } = planImport(`---\nid: ../../evil\n---\n\n# Branch: B\n\n- id: b\n`, "p.skilltree.md");
    expect(report.errors.map((d) => d.message)).toEqual([expect.stringMatching(/Pack "..\/..\/evil".*can't be written/)]);
  });
});

describe("content:import CLI", () => {
  const out = path.join(tmp, "content");

  it("--dry-run writes nothing", () => {
    const res = run([SEED_FILE, "--out", out, "--dry-run"]);
    expect(res.code).toBe(0);
    expect(fs.existsSync(out)).toBe(false);
  });

  it("writes the tree, which then loads cleanly with every id present", () => {
    expect(run([SEED_FILE, "--out", out]).code).toBe(0);
    expect(fs.existsSync(path.join(out, "branches/crypto/cosmos-staking.md"))).toBe(true);
    expect(fs.existsSync(path.join(out, "packs/seed-crypto-finance-the-tie.md"))).toBe(true);
    const tree = loadContentTree(out);
    expect(tree.diagnostics).toEqual([]);
    expect(tree.branches.map((b) => b.id)).toEqual(["swe", "finance", "crypto"]);
    expect(tree.skills).toHaveLength(24);
    const items = tree.skills.flatMap((s) => s.ranks.flatMap((r) => r.items));
    expect(items.every((i) => i.id !== "")).toBe(true);
    expect(tree.skills.flatMap((s) => s.recall).every((q) => /^q\d+$/.test(q.id))).toBe(true);
  });

  it("refuses to overwrite without --force", () => {
    const res = run([SEED_FILE, "--out", out]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/Refusing to overwrite 29 existing file/);
    expect(run([SEED_FILE, "--out", out, "--force"]).code).toBe(0);
  });

  it("rejects --out without a value instead of writing into a folder named after the next flag", () => {
    const res = run([SEED_FILE, "--out", "--dry-run"]);
    expect(res.code).toBe(2);
    expect(res.stderr).toMatch(/--out needs a value/);
  });

  it("refuses a bundle with parse errors", () => {
    const bad = path.join(tmp, "bad.skilltree.md");
    fs.writeFileSync(bad, "---\nid: bad\nfacts_as_of: 2026-01-01\n---\n\n# Branch: B\n\n- id: b\n\n## S\n- id: b.s\n\n### Rank 1\n- [ ] [lecture] X — ~10 min\n");
    const res = run([bad, "--out", path.join(tmp, "bad-out")]);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/Unknown item type/);
    expect(fs.existsSync(path.join(tmp, "bad-out"))).toBe(false);
  });
});
