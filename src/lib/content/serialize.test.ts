import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assignMissingIds } from "@/lib/content/ids";
import { parseBundle } from "@/lib/content/parse-bundle";
import { parsePackFile } from "@/lib/content/parse-pack";
import { parseBranchFile, parseQuestFile, parseSkillFile, parseTreeFiles } from "@/lib/content/parse-tree";
import { createContext } from "@/lib/content/parse-context";
import {
  serializeBranch,
  serializeBundle,
  serializeItem,
  serializePack,
  serializeQuest,
  serializeSkill,
  treeToFiles,
} from "@/lib/content/serialize";
import type { ContentTree, Item } from "@/lib/content/types";

const SEED_FILE = "crypto-finance-the-tie.skilltree.md";
const seed = fs.readFileSync(path.join(process.cwd(), SEED_FILE), "utf8");

/** Drops `file`/`line` everywhere: they describe where text sits, not what it means. */
function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== "file" && k !== "line")
        .map(([k, v]) => [k, strip(v)]),
    );
  }
  return value;
}

const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Compares content, ignoring positions and skill order within branches (the tree shape reorders them). */
function normalise(tree: ContentTree) {
  return {
    branches: strip(byId(tree.branches).map((b) => ({ ...b, skillIds: [...b.skillIds].sort() }))),
    skills: strip(byId(tree.skills)),
    quests: strip(byId(tree.quests)),
    packs: strip(byId(tree.packs)),
  };
}

describe("tree round-trip on the seed", () => {
  const tree = assignMissingIds(parseBundle(seed, SEED_FILE));
  const files = treeToFiles(tree, tree.packs);
  const tree2 = parseTreeFiles(files);

  it("writes the spec §1 layout", () => {
    expect(files).toHaveLength(3 + 24 + 1 + 1);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("content/branches/crypto/_branch.md");
    expect(paths).toContain("content/branches/crypto/cosmos-staking.md");
    expect(paths).toContain("content/quests/crypto-finance-the-tie.md");
    expect(paths).toContain("content/packs/seed-crypto-finance-the-tie.md");
  });

  it("parses back to the same content", () => {
    expect(tree2.diagnostics).toEqual([]);
    expect(tree2.shape).toBe("tree");
    expect(normalise(tree2)).toEqual(normalise(tree));
  });

  it("re-serializes every file identically (idempotent)", () => {
    expect(treeToFiles(tree2, tree2.packs).sort((a, b) => (a.path < b.path ? -1 : 1))).toEqual(
      [...files].sort((a, b) => (a.path < b.path ? -1 : 1)),
    );
  });

  it("serializeSkill is idempotent per skill", () => {
    for (const skill of tree.skills) {
      const text = serializeSkill(skill);
      const again = parseSkillFile(text, `content/branches/${skill.branchId}/${skill.slug}.md`);
      expect(again && serializeSkill(again)).toBe(text);
    }
  });

  it("round-trips branches, quests and packs through their own serializers", () => {
    const ctx = createContext("x");
    // A branch file alone doesn't list its skills; parseTreeFiles fills skillIds from the folder.
    for (const b of tree.branches) {
      expect(strip(parseBranchFile(serializeBranch(b), `content/branches/${b.id}/_branch.md`))).toEqual(strip({ ...b, skillIds: [] }));
    }
    const q = tree.quests[0];
    expect(strip(parseQuestFile(serializeQuest(q), "content/quests/crypto-finance-the-tie.md"))).toEqual(strip(q));
    const p = tree.packs[0];
    expect(strip(parsePackFile(serializePack(p), "content/packs/p.md", ctx))).toEqual(strip(p));
    expect(ctx.diagnostics).toEqual([]);
  });
});

describe("serializeSkill output", () => {
  const tree = assignMissingIds(parseBundle(seed, SEED_FILE));
  const get = (id: string) => tree.skills.find((s) => s.id === id)!;

  it("writes starting skills minimally", () => {
    const own = parseBundle(seed, SEED_FILE, { inheritFactsAsOf: false }).skills.find((s) => s.id === "swe.react")!;
    expect(serializeSkill(own)).toBe("# React\n- id: swe.react\n- requires: —\n- status: learned (self-reported)\n");
  });

  it("writes ranks, items with times and ids, flags and fields", () => {
    const text = serializeSkill(get("crypto.ethereum-staking"));
    expect(text).toContain("## Rank 1\n- [ ] [read] Pectra-era staking changes — ~45 min {#pectra-era-staking-changes}\n  - Do: skim");
    expect(text).toContain(
      "- [ ] [read] [time-sensitive] Figment — Glamsterdam: what it means for institutional stakers — ~30 min {#figment-glamsterdam-what-it-means-for}",
    );
    expect(text).toContain("## Recall\n- What did EIP-7251 change for large stakers? {#q1}");
    expect(text.startsWith("# Ethereum Staking Today\n- id: crypto.ethereum-staking\n- requires: crypto.eth-validators, crypto.staking-metrics\n")).toBe(true);
  });

  it("uses formatMinutes when there is no time text, and [optional] only when the title doesn't say so", () => {
    const base: Item = get("finance.money-settlement").ranks[0].items[0];
    const item: Item = { ...base, title: "Plain", timeText: null, minutes: 75, optional: true, id: "plain", fields: [] };
    expect(serializeItem(item)).toBe(`- [ ] [${base.rawType}] [optional] Plain — ~1 h 15 min {#plain}`);
    expect(serializeItem({ ...item, title: "Optional extra" })).toBe(`- [ ] [${base.rawType}] Optional extra — ~1 h 15 min {#plain}`);
    expect(serializeItem({ ...item, checked: true, minutes: null, id: "" })).toBe(`- [x] [${base.rawType}] [optional] Plain`);
    expect(serializeItem({ ...item, fields: [{ label: "Do", text: "a\nb", line: 0 }, { label: "", text: "note", line: 0 }] })).toBe(
      `- [ ] [${base.rawType}] [optional] Plain — ~1 h 15 min {#plain}\n  - Do: a\n    b\n  - note`,
    );
  });

  it("round-trips multi-paragraph fields without trailing whitespace", () => {
    const text = "# S\n- id: a.s\n- requires: —\n\n## Rank 1\n- [ ] [do] D — ~1 h {#d}\n  - Do: one\n\n    two\n  - Note: n\n";
    const skill = parseSkillFile(text, "content/branches/a/s.md");
    expect(skill && serializeSkill(skill)).toBe(text);
  });

  it("normalises an id written before the time to the end of the line", () => {
    const skill = parseSkillFile("# S\n- id: a.s\n- requires: —\n\n## Rank 1\n- [ ] [do] D {#d} — ~1 h\n", "content/branches/a/s.md");
    expect(skill && serializeSkill(skill)).toContain("- [ ] [do] D — ~1 h {#d}\n");
  });
});

describe("serializeBundle", () => {
  it("reproduces the seed byte for byte from its own parse", () => {
    const tree = parseBundle(seed, SEED_FILE);
    expect(serializeBundle(tree, tree.packs[0])).toBe(seed);
  });

  it("round-trips a tree through the bundle shape without a pack", () => {
    const tree = parseTreeFiles(treeToFiles(assignMissingIds(parseBundle(seed, SEED_FILE))));
    const text = serializeBundle(tree);
    const back = parseBundle(text, "export.skilltree.md");
    expect(back.diagnostics).toEqual([]);
    expect(back.packs[0].frontmatter).toMatchObject({ id: "skilltree-export", facts_as_of: "2026-09-23" });
    expect(normalise({ ...back, packs: [] })).toEqual(normalise({ ...tree, packs: [] }));
  });

  it("keeps --- lines and deeper headings inside skills when exporting a tree", () => {
    const files = [
      { path: "content/branches/b/_branch.md", text: "# B\n- id: b\n" },
      {
        path: "content/branches/b/a.md",
        text: "# A\n- id: b.a\n- requires: —\n\nDesc para.\n\n### Deep\n\nMore.\n\n---\n\n## Rank 1\n- [ ] [do] X — ~1 h {#x}\n  - Note: first\n\n    ---\n\n    after\n\n## Review log\nRound 1\n\n---\n\nRound 2\n",
      },
      { path: "content/branches/b/z.md", text: "# Z\n- id: b.z\n- requires: b.a\n" },
      {
        path: "content/quests/q.md",
        text: "# Q\n- id: quest-q\n\n| Weeks | Stage | Skills |\n| --- | --- | --- |\n| 1 | One | b.a |\n\nIntro.\n\n---\n\n## Maintenance (weekly)\n\n- [ ] [habit] H — ~10 min {#h}\n",
      },
    ];
    const tree = parseTreeFiles(files);
    expect(tree.diagnostics).toEqual([]);
    const back = parseBundle(serializeBundle(tree), "export.skilltree.md");
    expect(back.diagnostics).toEqual([]);
    expect(back.skills.map((s) => s.id)).toEqual(["b.a", "b.z"]);
    const a = back.skills[0];
    // A bare --- would close the branch in a bundle, so exported text uses ----, which renders the same.
    expect(a.description).toBe("Desc para.\n\n### Deep\n\nMore.\n\n----");
    expect(a.sections).toEqual([]);
    expect(a.ranks[0].items[0].fields[0].text).toBe("first\n\n---\n\nafter");
    expect(a.reviewLog).toBe("Round 1\n\n----\n\nRound 2");
    expect(back.quests[0].maintenance?.items.map((i) => i.id)).toEqual(["h"]);
    expect(back.packs[0].body).toBe("");
  });

  it("states facts_as_of only for skills that differ from the bundle", () => {
    const tree = parseBundle(seed, SEED_FILE);
    tree.skills[0].factsAsOf = "2026-01-01";
    const text = serializeBundle(tree, tree.packs[0]);
    expect(text.match(/- facts_as_of:/g)).toHaveLength(1);
    expect(parseBundle(text, SEED_FILE).skills[0].factsAsOf).toBe("2026-01-01");
  });
});
