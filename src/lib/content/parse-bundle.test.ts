import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBundle } from "@/lib/content/parse-bundle";
import type { Item, Skill } from "@/lib/content/types";

const SEED_FILE = "seed/crypto-finance-the-tie.skilltree.md";
const seed = fs.readFileSync(path.join(process.cwd(), SEED_FILE), "utf8");
const tree = parseBundle(seed, SEED_FILE);

const skill = (id: string): Skill => {
  const s = tree.skills.find((x) => x.id === id);
  if (!s) throw new Error(`no skill ${id}`);
  return s;
};
const allItems: Item[] = tree.skills.flatMap((s) => s.ranks.flatMap((r) => r.items));
const quest = tree.quests[0];

describe("parseBundle on the seed", () => {
  it("parses without parse errors", () => {
    expect(tree.shape).toBe("bundle");
    expect(tree.diagnostics).toEqual([]);
  });

  it("finds 3 branches and 24 skills", () => {
    expect(tree.branches.map((b) => [b.id, b.skillIds.length])).toEqual([
      ["swe", 5],
      ["finance", 6],
      ["crypto", 13],
    ]);
    expect(tree.skills).toHaveLength(24);
    expect(tree.branches[0]).toMatchObject({
      title: "Software Engineering",
      note: "seeded with skills I already have (self-reported). No items yet; later quests can add ranks to deepen them.",
      line: 53,
      file: SEED_FILE,
    });
    expect(tree.skills.every((s) => s.file === SEED_FILE)).toBe(true);
  });

  it("parses starting skills minimally", () => {
    expect(skill("swe.nextjs")).toMatchObject({
      title: "Next.js",
      branchId: "swe",
      slug: "nextjs",
      requires: ["swe.react"],
      status: "learned (self-reported)",
      estimate: null,
      why: null,
      ranks: [],
      recall: [],
    });
  });

  it("tracks skill line numbers", () => {
    expect(skill("crypto.cosmos-staking").line).toBe(368);
    expect(skill("swe.react").line).toBe(58);
  });

  it("parses one quest with 5 stages", () => {
    expect(tree.quests).toHaveLength(1);
    expect(quest).toMatchObject({ id: "quest-crypto-finance-the-tie", title: "Crypto & Finance for The Tie", weeks: 12 });
    expect(quest.hoursPerWeek).toEqual({ min: 4, max: 5 });
    expect(quest.goal).toMatch(/^go from "engineer who stakes and lends"/);
    expect(quest.stages.map((s) => [s.name, s.weekStart, s.weekEnd])).toEqual([
      ["Foundations", 1, 3],
      ["Staking", 4, 7],
      ["DeFi", 8, 9],
      ["Markets", 10, 12],
      ["Follow-on", 13, null],
    ]);
    expect(quest.stages[0].line).toBe(567);
  });

  it("parses stage steps with rank limits", () => {
    const [, staking, , markets] = quest.stages;
    expect(staking.steps).toHaveLength(8);
    expect(staking.steps).toContainEqual({
      skillId: "finance.market-intelligence",
      ranks: [1],
      text: "finance.market-intelligence (Rank 1)",
    });
    expect(markets.steps.find((s) => s.skillId === "finance.market-structure")?.ranks).toEqual([1, 2]);
    expect(markets.steps.find((s) => s.skillId === "finance.market-intelligence")?.ranks).toEqual([2]);
    expect(staking.steps[0]).toEqual({ skillId: "crypto.staking-metrics", ranks: null, text: "crypto.staking-metrics" });
  });

  it("parses the maintenance section and its habits", () => {
    const m = quest.maintenance;
    expect(m).not.toBeNull();
    expect(m).toMatchObject({
      heading: "Maintenance (weekly, from week 13, ~2 h/week)",
      fromWeek: 13,
      hoursPerWeek: 2,
      description: "Keeps learned skills from going rusty.",
      line: 573,
    });
    expect(m?.cadence).toEqual({ unit: "week", times: 1, text: "weekly" });
    expect(m?.items).toHaveLength(6);
    expect(m?.items.every((i) => i.type === "habit" && i.ownerId === quest.id)).toBe(true);
    const twice = m?.items.find((i) => i.title.includes("twice a week"));
    expect(twice?.cadence).toEqual({ unit: "week", times: 2, text: "2× week" });
    expect(twice?.minutes).toBeNull();
    expect(m?.items[0]).toMatchObject({ title: "Unchained's weekly news episode", minutes: 45, timeText: "~45 min at 1.5x" });
    expect(m?.items.filter((i) => i.cadence?.unit === "week" && i.cadence.times === 1)).toHaveLength(5);
  });

  it("counts typed resources and time-sensitive items", () => {
    const resources = [...allItems, ...(quest.maintenance?.items ?? [])].flatMap((i) => i.resources);
    expect(resources.filter((r) => r.type === "search")).toHaveLength(14);
    expect(allItems.filter((i) => i.timeSensitive)).toHaveLength(9);
  });

  it("splits a title containing ' — ' from its time", () => {
    const figment = allItems.find((i) => i.title.startsWith("Figment"));
    expect(figment).toMatchObject({
      title: "Figment — Glamsterdam: what it means for institutional stakers",
      minutes: 30,
      timeText: "~30 min",
      type: "read",
      timeSensitive: true,
      ownerId: "crypto.ethereum-staking",
      line: 320,
    });
    expect(figment?.verify).toMatch(/^as of mid-August 2026/);
    expect(figment?.resources).toEqual([
      {
        type: "article",
        title: "Figment article",
        url: "https://www.figment.io/insights/glamsterdam-what-ethereums-next-upgrade-means-for-institutional-stakers/",
        field: "Resource",
      },
    ]);
  });

  it("parses rank names and rank-level requires", () => {
    const mi = skill("finance.market-intelligence");
    expect(mi.requires).toEqual([]);
    expect(mi.ranks.map((r) => [r.id, r.number, r.name, r.requires, r.items.length])).toEqual([
      ["rank-1", 1, "Feeds and alerts", ["crypto.staking-metrics"], 3],
      ["rank-2", 2, "Research workflow", ["finance.market-structure"], 5],
    ]);
    expect(skill("finance.money-settlement").ranks[0].name).toBeNull();
  });

  it("parses estimates with optional hours", () => {
    expect(skill("finance.institutions").estimate).toEqual({ text: "~3.5 h + optional book (~6 h)", hours: 3.5, optionalHours: 6 });
    expect(skill("crypto.defi-mechanics").estimate).toEqual({ text: "~2 h (+1 h optional)", hours: 2, optionalHours: 1 });
    expect(skill("crypto.infrastructure").estimate).toEqual({ text: "~3 h + monthly habits", hours: 3, optionalHours: null });
  });

  it("sets optional on the three 'Optional…' items", () => {
    const optional = allItems.filter((i) => i.optional);
    expect(optional.map((i) => i.ownerId)).toEqual(["finance.institutions", "crypto.liquid-staking", "crypto.defi-mechanics"]);
    expect(optional.every((i) => /^Optional/.test(i.title))).toBe(true);
    const insider = optional.find((i) => i.ownerId === "crypto.liquid-staking");
    expect(insider?.minutes).toBeNull();
    expect(insider?.timeText).toBeNull();
  });

  it("infers skill habit cadences from their titles", () => {
    const habits = skill("crypto.infrastructure").ranks[0].items.filter((i) => i.type === "habit");
    expect(habits.map((h) => h.cadence?.unit)).toEqual(["month", "year"]);
    expect(habits[0].resources.map((r) => r.type)).toEqual(["podcast", "podcast"]);
  });

  it("inherits the bundle's facts_as_of on every skill", () => {
    expect(tree.skills.every((s) => s.factsAsOf === "2026-09-23")).toBe(true);
    const own = parseBundle(seed, SEED_FILE, { inheritFactsAsOf: false });
    expect(own.skills.every((s) => s.factsAsOf === null)).toBe(true);
  });

  it("keeps the pack frontmatter and every non-skill section in the pack body", () => {
    const [pack] = tree.packs;
    expect(pack).toMatchObject({
      id: "seed-crypto-finance-the-tie",
      title: "Skill tree seed — Crypto & Finance for The Tie",
      factsAsOf: "2026-09-23",
      file: SEED_FILE,
    });
    expect(pack.frontmatter).toMatchObject({ owner: "Rihards", review_rounds: 4, branches: ["swe", "finance", "crypto"] });
    expect(pack.body.startsWith("# Skill tree seed: Crypto & Finance for The Tie")).toBe(true);
    expect(pack.body).toContain("## Conventions");
    expect(pack.body).toContain("| The Tie Capital |");
    expect(pack.body).toContain("## Review log");
    expect(pack.body).toContain("**Open for round 5**");
    expect(pack.body).toContain("## Sources (for facts stated above, as of 2026-09-23)");
    expect(pack.body).toContain("- [Latham & Watkins: US Crypto Policy Tracker](https://www.lw.com/en/us-crypto-policy-tracker/legislative-developments)");
    expect(pack.body).not.toContain("# Branch:");
    expect(pack.body).not.toContain("## Money, Ledgers and Settlement");
  });

  it("keeps unknown sub-bullet labels as fields in order", () => {
    const lst = skill("crypto.liquid-staking").ranks[0].items[0];
    expect(lst.fields.map((f) => f.label)).toEqual(["Do", "Case study", "Done when"]);
    expect(lst.fields[1].line).toBe(414);
    expect(lst.resources).toEqual([
      expect.objectContaining({ type: "article", title: "Galaxy's timeline", field: "Case study" }),
    ]);
    expect(lst.doneWhen).toBe("I can explain why an LST can crash on one venue while its redemption value is unchanged.");
  });

  it("fills convenience fields and resources from every field", () => {
    const build = skill("crypto.cosmos-staking").ranks[0].items.find((i) => i.type === "build");
    expect(build?.do).toMatch(/^fetch `\/cosmos\/mint\/v1beta1\/params`/);
    expect(build?.ifStuck).toBe("start from SR's Cosmos Hub SRB doc and compute with SR's own inputs first.");
    const inflation = skill("crypto.cosmos-staking").ranks[0].items[1];
    expect(inflation.resources).toEqual([expect.objectContaining({ type: "tool", title: "ATOM page", field: "Done when" })]);
  });

  it("parses recall questions without ids in a bundle", () => {
    const recall = skill("crypto.consensus").recall;
    expect(recall).toHaveLength(3);
    expect(recall[0]).toEqual({ id: "", text: "Why can BFT consensus tolerate fewer than one third faulty validators, but not more?", line: 264 });
  });

  it("points an invalid bundle facts_as_of at its own frontmatter line", () => {
    const bad = parseBundle("---\nid: p\nfacts_as_of: 2026-02-30\n---\n\n# Branch: B\n\n- id: b\n", "p.skilltree.md");
    expect(bad.diagnostics).toEqual([expect.objectContaining({ code: "parse", line: 3, message: expect.stringMatching(/Invalid facts_as_of/) })]);
  });

  it("leaves bundle item ids empty and keys owner-prefixed", () => {
    expect(allItems.every((i) => i.id === "" && i.key === `${i.ownerId}/`)).toBe(true);
  });
});
