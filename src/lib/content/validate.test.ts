import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ContentTree, Diagnostic } from "@/lib/content/types";
import { sortDiagnostics, summarize, validate, type ValidateOptions } from "@/lib/content/validate";
import {
  LONG_DONE_WHEN,
  LONG_WHY,
  MONTHLY,
  WEEKLY,
  asBundle,
  branch,
  habit,
  item,
  maintenance,
  pack,
  quest,
  rank,
  recall,
  resource,
  skill,
  stage,
  startingSkill,
  step,
  tree,
  validTree,
} from "@/lib/content/__fixtures__/builders";

const TODAY = "2026-09-23";

function run(t: ContentTree, opts: ValidateOptions = {}): Diagnostic[] {
  return validate(t, { today: TODAY, ...opts });
}

function only(diags: Diagnostic[], code: string): Diagnostic[] {
  return diags.filter((d) => d.code === code);
}

function codes(diags: Diagnostic[]): string[] {
  return diags.map((d) => d.code);
}

/** A time-sensitive item that is otherwise complete. */
function timeSensitive(overrides: Parameters<typeof item>[0] = {}) {
  return item({ timeSensitive: true, verify: "Check whether it shipped on mainnet.", ...overrides });
}

describe("validate: baseline", () => {
  it("reports nothing for a valid tree, bundle or quest", () => {
    expect(run(validTree())).toEqual([]);
    expect(run(asBundle(validTree()))).toEqual([]);
    const q = quest("quest-main", {
      stages: [stage("One", [step("b.one"), step("b.two")])],
      maintenance: maintenance([habit({ cadence: WEEKLY })]),
    });
    expect(run(validTree([], { quests: [q] }))).toEqual([]);
  });

  it("passes the tree's parse diagnostics through", () => {
    const parse: Diagnostic = { severity: "error", code: "parse", message: "Unknown item type", file: "content/x.md", line: 3 };
    expect(run(validTree([], { diagnostics: [parse] }))).toEqual([parse]);
  });

  it("rejects an invalid today", () => {
    expect(() => validate(validTree(), { today: "23.09.2026" })).toThrow(RangeError);
  });
});

describe("validate: duplicate-id", () => {
  it("flags a repeated skill id at the second occurrence", () => {
    const first = skill("b.one", { title: "First one" });
    const second = skill("b.one", { file: "content/branches/b/one-copy.md", line: 7 });
    const diags = only(run(tree({ branches: [branch("b")], skills: [first, second, skill("b.two")] })), "duplicate-id");
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ severity: "error", file: "content/branches/b/one-copy.md", line: 7, skillId: "b.one" });
    expect(diags[0].message).toContain('"First one" (content/branches/b/one.md:1)');
  });

  it("flags repeated branch and quest ids", () => {
    const t = validTree([], {
      branches: [branch("b", { skillIds: ["b.one", "b.two", "b.three"] }), branch("b", { line: 30 })],
      quests: [quest("quest-q"), quest("quest-q", { line: 9 })],
    });
    const diags = only(run(t), "duplicate-id");
    expect(diags.map((d) => [d.file, d.line, d.questId])).toEqual([
      ["content/branches/b/_branch.md", 30, undefined],
      ["content/quests/q.md", 9, "quest-q"],
    ]);
  });

  it("flags item ids repeated within a skill, across ranks, but not across skills", () => {
    const a = item({ id: "same" });
    const b = item({ id: "same" });
    const s = skill("b.one", { ranks: [rank(1, [a]), rank(2, [b])], estimate: { text: "~2 h", hours: 2, optionalHours: null } });
    const other = skill("b.two", { ranks: [rank(1, [item({ id: "same" })])] });
    const diags = only(run(validTree([s, other])), "duplicate-id");
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ line: b.line, skillId: "b.one", itemId: "same" });
    expect(diags[0].message).toContain(`line ${a.line}`);
  });

  it("ignores empty item and recall ids (bundles may omit them)", () => {
    const s = skill("b.one", {
      ranks: [rank(1, [item({ id: "", minutes: 30 }), item({ id: "", minutes: 30 })])],
      recall: recall(3, false),
    });
    expect(codes(run(asBundle(validTree([s]))))).not.toContain("duplicate-id");
  });

  it("flags recall ids repeated within a skill only", () => {
    const qs = recall(3);
    qs[2] = { ...qs[2], id: "q1" };
    const diags = only(run(validTree([skill("b.one", { recall: qs })])), "duplicate-id");
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ line: qs[2].line, skillId: "b.one" });
  });

  it("flags repeated maintenance item ids within a quest", () => {
    const q = quest("quest-q", { maintenance: maintenance([habit({ id: "h" }), habit({ id: "h", line: 77 })]) });
    const diags = only(run(validTree([], { quests: [q] })), "duplicate-id");
    expect(diags).toEqual([expect.objectContaining({ line: 77, questId: "quest-q", itemId: "h" })]);
  });
});

describe("validate: unresolved-ref", () => {
  it("flags unknown requires and related ids, with a suggestion", () => {
    const s = skill("b.one", { requires: ["b.twoo"], related: ["x.nothing"] });
    const diags = only(run(validTree([s])), "unresolved-ref");
    expect(diags).toHaveLength(2);
    expect(diags[0].message).toBe(`b.one requires "b.twoo", which isn't a skill id (did you mean "b.two"?)`);
    expect(diags[1].message).toContain(`"x.nothing", which isn't a skill id`);
    expect(diags[1].message).not.toContain("did you mean");
  });

  it("flags unknown rank-level requires at the rank line", () => {
    const r = rank(1, [item()], { requires: ["b.ghost"], line: 42 });
    const diags = only(run(validTree([skill("b.one", { ranks: [r] })])), "unresolved-ref");
    expect(diags).toEqual([expect.objectContaining({ line: 42, skillId: "b.one" })]);
    expect(diags[0].message).toContain("Rank 1 of b.one requires");
  });

  it("flags a skill whose branch doesn't exist", () => {
    const t = tree({ branches: [], skills: [skill("b.one")] });
    const diags = only(run(t), "unresolved-ref");
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('branch "b", which doesn\'t exist — add content/branches/b/_branch.md');
    expect(only(run(asBundle(t)), "unresolved-ref")[0].message).toContain('"- id: b"');
  });

  it("flags quest steps naming unknown skills or ranks", () => {
    const st = stage("One", [step("b.nope"), step("b.one", [1, 2])], { line: 12 });
    const diags = only(run(validTree([], { quests: [quest("quest-q", { stages: [st] })] })), "unresolved-ref");
    expect(diags).toHaveLength(2);
    expect(diags[0]).toMatchObject({ line: 12, questId: "quest-q" });
    expect(diags[1].message).toBe('Quest step "b.one (Ranks 1–2)" names Rank 2, but b.one only has Rank 1');
  });

  it("accepts cross-branch references that resolve", () => {
    const t = validTree([skill("c.one"), skill("c.two"), skill("c.three", { requires: ["b.one"], related: ["b.two"] })]);
    expect(run(t)).toEqual([]);
  });
});

describe("validate: cycle", () => {
  it("reports a skill-level cycle once, as a path", () => {
    const t = validTree([skill("b.one", { requires: ["b.two"] }), skill("b.two", { requires: ["b.one"] })]);
    const diags = only(run(t), "cycle");
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("Prerequisite cycle: b.one → b.two → b.one");
    expect(diags[0]).toMatchObject({ severity: "error", skillId: "b.one", line: 1 });
  });

  it("follows rank-level requires and names the rank", () => {
    const one = skill("b.one", {
      ranks: [rank(1), rank(2, [item()], { requires: ["b.two"] })],
      estimate: { text: "~2 h", hours: 2, optionalHours: null },
    });
    const diags = only(run(validTree([one, skill("b.two", { requires: ["b.one"] })])), "cycle");
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("b.one → b.two → b.one (b.one Rank 2 requires b.two)");
  });

  it("reports a self-requirement", () => {
    const diags = only(run(validTree([skill("b.one", { requires: ["b.one"] })])), "cycle");
    expect(diags.map((d) => d.message)).toEqual([expect.stringContaining("b.one → b.one")]);
  });

  it("reports each distinct cycle through a shared node", () => {
    const t = validTree([
      skill("b.one", { requires: ["b.two", "b.three"] }),
      skill("b.two", { requires: ["b.one"] }),
      skill("b.three", { requires: ["b.two"] }),
    ]);
    const messages = only(run(t), "cycle").map((d) => d.message);
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.includes("b.one → b.two → b.one"))).toBe(true);
    expect(messages.some((m) => m.includes("b.one → b.three → b.two → b.one"))).toBe(true);
  });

  it("accepts a diamond (shared prerequisites are not cycles)", () => {
    const t = validTree([
      skill("b.two", { requires: ["b.one"] }),
      skill("b.three", { requires: ["b.one"] }),
      skill("b.four", { requires: ["b.two", "b.three"] }),
    ]);
    expect(only(run(t), "cycle")).toEqual([]);
  });

  it("caps the list for a hopelessly tangled graph", () => {
    const ids = ["c.a", "c.b", "c.c", "c.d", "c.e"];
    const skills = ids.map((id) => skill(id, { requires: ids.filter((x) => x !== id) }));
    const diags = only(run(validTree(skills)), "cycle");
    expect(diags).toHaveLength(26);
    expect(diags.some((d) => d.message.startsWith("More than 25 prerequisite cycles"))).toBe(true);
  });
});

describe("validate: required skill content", () => {
  it("requires Why, estimate, a rank and 3 Recall questions on non-starting skills", () => {
    const bare = skill("b.one", { why: null, estimate: null, ranks: [], recall: [] });
    expect(codes(run(validTree([bare]))).sort()).toEqual(["missing-estimate", "missing-rank", "missing-why", "recall-too-few"]);
  });

  it("treats a blank Why and an estimate without hours as missing", () => {
    const s = skill("b.one", { why: "   ", estimate: { text: "a while", hours: null, optionalHours: null } });
    const diags = run(validTree([s]));
    expect(codes(diags).sort()).toEqual(["missing-estimate", "missing-why"]);
    expect(only(diags, "missing-estimate")[0].message).toContain('"a while" with no core hours');
  });

  it("needs at least 3 Recall questions", () => {
    expect(only(run(validTree([skill("b.one", { recall: recall(2) })])), "recall-too-few")[0].message).toContain(
      "only 2 Recall questions",
    );
    expect(only(run(validTree([skill("b.one", { recall: recall(3) })])), "recall-too-few")).toEqual([]);
  });

  it("exempts starting skills from Why, estimate, ranks and Recall", () => {
    expect(run(validTree([startingSkill("b.one")]))).toEqual([]);
    expect(run(validTree([startingSkill("b.one", { recall: recall(1) })]))).toEqual([]);
  });

  it("still applies item and rank rules to a starting skill's items", () => {
    const s = startingSkill("b.one", { ranks: [rank(1, [item({ minutes: null, timeText: null, doneWhen: null })])] });
    expect(codes(run(validTree([s]))).sort()).toEqual(["item-missing-time", "rank-missing-done-when"]);
  });
});

describe("validate: item rules", () => {
  it("requires a time on every item, including optional items and habits", () => {
    const optional = item({
      type: "watch",
      optional: true,
      minutes: null,
      timeText: null,
      doneWhen: null,
      title: "Optional: SR's Staking Insider podcast back catalog (inactive, but the founder interviews hold up)",
    });
    const monthly = habit({ minutes: null, timeText: null });
    const s = skill("b.one", { ranks: [rank(1, [item(), optional, monthly])] });
    const diags = only(run(validTree([s])), "item-missing-time");
    expect(diags).toHaveLength(2);
    expect(diags[0]).toMatchObject({ line: optional.line, skillId: "b.one", itemId: optional.id });
    expect(diags[0].message).toBe(
      `"Optional: SR's Staking Insider podcast…" has no time estimate — add " — ~N min" to the item line`,
    );
  });

  it("asks maintenance items for an item-level As of (quests have no facts_as_of)", () => {
    const q = quest("quest-q", { maintenance: maintenance([habit({ timeSensitive: true, verify: "Check the show still airs." })]) });
    const diags = only(run(validTree([], { quests: [q] })), "missing-facts-as-of");
    expect(diags).toEqual([expect.objectContaining({ questId: "quest-q" })]);
    expect(diags[0].message).toContain('add an "As of: YYYY-MM-DD" line to the item');
  });

  it("points quest search-link warnings at the Maintenance section", () => {
    const q = quest("quest-q", { maintenance: maintenance([habit({ resources: [resource("search")] })], { line: 61 }) });
    const diags = only(run(validTree([], { quests: [q] })), "search-links");
    expect(diags).toEqual([expect.objectContaining({ line: 61, questId: "quest-q" })]);
  });

  it("requires a time on quest maintenance habits and explains unreadable times", () => {
    const h = habit({ minutes: null, timeText: "~a bit" });
    const q = quest("quest-q", { maintenance: maintenance([h]) });
    const diags = only(run(validTree([], { quests: [q] })), "item-missing-time");
    expect(diags).toEqual([expect.objectContaining({ questId: "quest-q", itemId: h.id })]);
    expect(diags[0].message).toContain('has a time "~a bit" that can\'t be read');
  });

  it("needs a Done when on at least one item per rank (optional items count)", () => {
    const missing = rank(1, [item({ doneWhen: null }), item({ doneWhen: null, minutes: 30 })], { line: 64 });
    const diags = only(run(validTree([skill("b.one", { ranks: [missing], estimate: { text: "~1.5 h", hours: 1.5, optionalHours: null } })])), "rank-missing-done-when");
    expect(diags).toEqual([expect.objectContaining({ line: 64, skillId: "b.one" })]);

    const oneEnough = rank(1, [item({ doneWhen: null }), item({ optional: true, minutes: 30 })]);
    expect(only(run(validTree([skill("b.one", { ranks: [oneEnough] })])), "rank-missing-done-when")).toEqual([]);
  });

  it("needs If stuck on build items only", () => {
    const build = item({ type: "build", ifStuck: null });
    const diags = run(validTree([skill("b.one", { ranks: [rank(1, [build])] })]));
    expect(only(diags, "build-missing-if-stuck")).toEqual([expect.objectContaining({ line: build.line, itemId: build.id })]);
    expect(only(run(validTree()), "build-missing-if-stuck")).toEqual([]);
  });

  it("needs Verify on time-sensitive items", () => {
    const ts = timeSensitive({ verify: null });
    const s = skill("b.one", { ranks: [rank(1, [ts])], factsAsOf: TODAY, sources: [{ title: "S", url: "u", note: null, line: 90 }] });
    expect(codes(run(validTree([s])))).toEqual(["time-sensitive-missing-verify"]);
  });

  it("needs an as-of date for time-sensitive items, from the item, the skill or the bundle", () => {
    const src = [{ title: "S", url: "https://s.example", note: null, line: 90 }];
    const noDate = skill("b.one", { ranks: [rank(1, [timeSensitive()])], sources: src });
    expect(codes(run(validTree([noDate])))).toEqual(["missing-facts-as-of"]);

    const itemDate = skill("b.one", { ranks: [rank(1, [timeSensitive({ asOf: TODAY })])], sources: src });
    expect(run(validTree([itemDate]))).toEqual([]);

    const skillDate = skill("b.one", { ranks: [rank(1, [timeSensitive()])], sources: src, factsAsOf: TODAY });
    expect(run(validTree([skillDate]))).toEqual([]);

    const bundle = asBundle(validTree([noDate], { packs: [pack({ factsAsOf: TODAY })] }));
    expect(run(bundle)).toEqual([]);
    expect(codes(run(asBundle(validTree([noDate]))))).toEqual(["missing-facts-as-of"]);
  });
});

describe("validate: quest-order", () => {
  // b.split has two ranks; its Rank 2 needs b.base. b.early and b.late need all of b.split.
  const base = skill("b.base");
  const split = skill("b.split", {
    ranks: [rank(1), rank(2, [item()], { requires: ["b.base"] })],
    estimate: { text: "~2 h", hours: 2, optionalHours: null },
  });
  const early = skill("b.early", { requires: ["b.split"] });
  const late = skill("b.late", { requires: ["b.split"] });
  const withQuest = (...stages: ReturnType<typeof stage>[]) =>
    validTree([base, split, early, late], { quests: [quest("quest-q", { stages })] });

  it("counts a rank-split skill as scheduled only once all its ranks are", () => {
    const one = stage("One", [step("b.split", [1]), step("b.early")], { line: 10 });
    const two = stage("Two", [step("b.base"), step("b.split", [2]), step("b.late")], { line: 11 });
    const diags = only(run(withQuest(one, two)), "quest-order");
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ severity: "error", line: 10, questId: "quest-q", skillId: "b.early" });
    expect(diags[0].message).toBe(
      '"b.early" in stage "One" comes before its prerequisite b.split — only Rank 1 of b.split is scheduled earlier; schedule Rank 2 before it',
    );
  });

  it("checks rank-level requires only for the ranks a step covers", () => {
    const rank1First = stage("One", [step("b.split", [1]), step("b.base"), step("b.split", [2])]);
    expect(only(run(withQuest(rank1First)), "quest-order")).toEqual([]);

    const rank2First = stage("One", [step("b.split", [2]), step("b.base")], { line: 15 });
    const diags = only(run(withQuest(rank2First)), "quest-order");
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("prerequisite b.base (required by Rank 2)");
    expect(diags[0].message).toContain('move b.base earlier (it\'s scheduled later, in stage "One")');
  });

  it("checks every rank's requires on a whole-skill step", () => {
    const diags = only(run(withQuest(stage("One", [step("b.split")]))), "quest-order");
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("schedule b.base in an earlier stage (it isn't in this quest)");
  });

  it("accepts prerequisites from earlier steps in the same stage and from earlier stages", () => {
    const ok = [stage("One", [step("b.base"), step("b.split")]), stage("Two", [step("b.early"), step("b.late")])];
    expect(only(run(withQuest(...ok)), "quest-order")).toEqual([]);
  });

  it("flags a skill scheduled before its prerequisite", () => {
    const bad = [stage("One", [step("b.early")], { line: 3 }), stage("Two", [step("b.base"), step("b.split")])];
    const diags = only(run(withQuest(...bad)), "quest-order");
    expect(diags).toEqual([expect.objectContaining({ line: 3, skillId: "b.early" })]);
    expect(diags[0].message).toContain('scheduled later, in stage "Two"');
  });

  it("never requires starting skills to be scheduled", () => {
    const t = validTree([startingSkill("b.start"), skill("b.one", { requires: ["b.start"] })], {
      quests: [quest("quest-q", { stages: [stage("One", [step("b.one")])] })],
    });
    expect(run(t)).toEqual([]);
  });

  it("requires a prerequisite with no ranks to appear earlier", () => {
    const empty = skill("b.empty", { ranks: [] });
    const needs = skill("b.needs", { requires: ["b.empty"] });
    const t = validTree([empty, needs], { quests: [quest("quest-q", { stages: [stage("One", [step("b.needs")])] })] });
    expect(only(run(t), "quest-order")).toHaveLength(1);
  });
});

describe("validate: tree-shape-only rules", () => {
  const noIds = skill("b.one", {
    ranks: [rank(1, [item({ id: "" })])],
    recall: recall(3, false),
    file: "content/branches/other/one.md",
  });
  const q = quest("quest-q", { file: "content/quests/wrong.md", maintenance: maintenance([habit({ id: "" })]) });
  const b = branch("b", { file: "content/branches/bee/_branch.md", skillIds: ["b.one", "b.two", "b.three"] });

  it("flags missing item and recall ids and mismatched paths in the tree shape", () => {
    const t = validTree([noIds], { quests: [q], branches: [b] });
    const diags = run(t);
    expect(only(diags, "missing-item-id")).toHaveLength(2);
    expect(only(diags, "missing-recall-id")).toHaveLength(3);
    const paths = only(diags, "path-mismatch").map((d) => d.message);
    expect(paths).toEqual([
      "content/branches/bee/_branch.md doesn't match its branch id \"b\": expected content/branches/b/_branch.md — move the file (never change an existing id)",
      expect.stringContaining("expected content/branches/b/one.md"),
      expect.stringContaining("expected content/quests/q.md"),
    ]);
  });

  it("does not fire for bundles", () => {
    const diags = run({ ...validTree([noIds], { quests: [q], branches: [b] }), shape: "bundle" });
    expect(codes(diags)).not.toContain("missing-item-id");
    expect(codes(diags)).not.toContain("missing-recall-id");
    expect(codes(diags)).not.toContain("path-mismatch");
  });

  it("accepts a content directory at another path", () => {
    const moved = validTree([skill("b.one", { file: "/tmp/x/branches/b/one.md" })]);
    expect(run(moved)).toEqual([]);
    const wrong = validTree([skill("b.one", { file: "/tmp/x/branches/b/one-two.md" })]);
    expect(codes(run(wrong))).toEqual(["path-mismatch"]);
  });
});

describe("validate: warnings", () => {
  const withItems = (items: ReturnType<typeof item>[], extra: Parameters<typeof skill>[1] = {}) =>
    validTree([skill("b.one", { ranks: [rank(1, items)], ...extra })]);

  it("rank-not-active: a rank with no do / build / output item", () => {
    const diags = run(withItems([item({ type: "read" }), item({ type: "watch", minutes: 30 })], { estimate: { text: "~1.5 h", hours: 1.5, optionalHours: null } }));
    expect(only(diags, "rank-not-active")).toEqual([expect.objectContaining({ severity: "warning", skillId: "b.one" })]);
    expect(only(run(withItems([item({ type: "read" }), item({ type: "output", optional: true })])), "rank-not-active")).toEqual([]);
  });

  it("too-many-resources: more than 5 typed links on one item", () => {
    const five = Array.from({ length: 5 }, () => resource("article"));
    expect(only(run(withItems([item({ resources: five })])), "too-many-resources")).toEqual([]);
    const diags = only(run(withItems([item({ resources: [...five, resource("video")] })])), "too-many-resources");
    expect(diags[0].message).toContain("has 6 typed links (max 5)");
  });

  it("estimate-mismatch: required minutes outside ±25% of the estimate", () => {
    const at = (minutes: number) => only(run(withItems([item({ minutes: minutes / 2 }), item({ minutes: minutes / 2 })])), "estimate-mismatch");
    expect(at(75)).toEqual([]); // exactly +25%
    expect(at(45)).toEqual([]); // exactly −25%
    expect(at(80)[0].message).toBe(
      "Required items in b.one add up to 1 h 20 min, but the estimate is ~1 h (outside ±25%) — update the estimate or the item times",
    );
    expect(at(40)).toHaveLength(1);
  });

  it("estimate-mismatch ignores optional items and habits, and skills without items or hours", () => {
    const extras = [item(), item({ optional: true, minutes: 300 }), habit({ minutes: 300 })];
    expect(only(run(withItems(extras)), "estimate-mismatch")).toEqual([]);
    expect(only(run(validTree([startingSkill("b.one", { estimate: { text: "~9 h", hours: 9, optionalHours: null } })])), "estimate-mismatch")).toEqual([]);
    expect(only(run(withItems([item({ minutes: 600 })], { estimate: { text: "?", hours: null, optionalHours: null } })), "estimate-mismatch")).toEqual([]);
  });

  it("search-links: one warning per skill with the count, summed in summarize()", () => {
    const a = item({ resources: [resource("search"), resource("search"), resource("video")] });
    const b = item({ resources: [resource("search")] });
    const s = skill("b.one", { ranks: [rank(1, [a, b])], estimate: { text: "~2 h", hours: 2, optionalHours: null } });
    const s2 = skill("b.two", { ranks: [rank(1, [item({ resources: [resource("search")] })])] });
    const diags = run(validTree([s, s2]));
    const search = only(diags, "search-links");
    expect(search).toHaveLength(2);
    expect(search[0]).toMatchObject({ severity: "warning", skillId: "b.one", line: 1 });
    expect(search[0].message).toBe(`3 @search@ links to resolve into exact videos (lines ${a.line}, ${b.line})`);
    expect(search[1].message).toContain("1 @search@ link to resolve");
    expect(summarize(diags).searchLinks).toBe(4);
  });

  it("short-why: under 40 characters once links are reduced to their titles", () => {
    expect(only(run(validTree([skill("b.one", { why: "Short why." })])), "short-why")[0].message).toContain("is 10 characters");
    const linky = "See [@article@this](https://example.com/a/very/long/url/that/does/not/count)";
    expect(only(run(validTree([skill("b.one", { why: linky })])), "short-why")).toHaveLength(1);
    expect(only(run(validTree([skill("b.one", { why: LONG_WHY })])), "short-why")).toEqual([]);
    expect(only(run(validTree([startingSkill("b.one", { why: "Tiny." })])), "short-why")).toHaveLength(1);
  });

  it("short-done-when and passive-done-when point at the Done when line", () => {
    const short = item({ doneWhen: "I can explain it.", fields: [{ label: "Done when", text: "I can explain it.", line: 321 }] });
    const diags = run(withItems([short]));
    expect(only(diags, "short-done-when")).toEqual([expect.objectContaining({ line: 321, itemId: short.id })]);
    expect(only(diags, "passive-done-when")).toEqual([]);
    expect(only(run(withItems([item({ doneWhen: LONG_DONE_WHEN })])), "short-done-when")).toEqual([]);
  });

  it("passive-done-when: 'I understand', 'I know', 'I'm familiar', 'I get'", () => {
    const passive = [
      "I understand how validators earn rewards on Ethereum today.",
      "I know which Terminal staking fields match SR's definitions.",
      "I'm familiar with the main categories of DeFi exploits out there.",
      "I get why the basis trade pays and when it stops paying out.",
    ];
    for (const text of passive) {
      const diags = only(run(withItems([item({ doneWhen: text })])), "passive-done-when");
      expect(diags, text).toHaveLength(1);
    }
    expect(only(run(withItems([item({ doneWhen: "I can predict which way funding moves when longs pile in." })])), "passive-done-when")).toEqual([]);
  });

  it("no-sources: time-sensitive items need Sources", () => {
    const ts = timeSensitive({ resources: [{ ...resource("article"), url: "https://facts.example/page" }] });
    const bare = skill("b.one", { ranks: [rank(1, [ts])], factsAsOf: TODAY });
    expect(only(run(validTree([bare])), "no-sources")).toHaveLength(1);
    const sourced = { ...bare, sources: [{ title: "Facts", url: "https://facts.example/page", note: null, line: 80 }] };
    expect(only(run(validTree([sourced])), "no-sources")).toEqual([]);
    expect(only(run(validTree([skill("b.one")])), "no-sources")).toEqual([]);
  });

  it("no-sources: in a bundle, a pack source the skill links to counts (the importer copies it)", () => {
    const ts = timeSensitive({ fields: [{ label: "Note", text: "Per [Galaxy](https://facts.example/page/).", line: 5 }] });
    const bare = skill("b.one", { ranks: [rank(1, [ts])], factsAsOf: TODAY });
    const body = "# Seed\n\nIntro [not a source](https://facts.example/page)\n\n## Sources (as of 2026-09-23)\n\n- [Galaxy](https://facts.example/page)\n\n## Other\n";
    expect(only(run(asBundle(validTree([bare], { packs: [pack({ body })] }))), "no-sources")).toEqual([]);
    const unrelated = "## Sources\n\n- [Elsewhere](https://other.example)\n";
    expect(only(run(asBundle(validTree([bare], { packs: [pack({ body: unrelated })] }))), "no-sources")).toHaveLength(1);
    const introOnly = "# Seed\n\n[intro link](https://facts.example/page)\n\n## Sources\n\n- [Elsewhere](https://other.example)\n";
    expect(only(run(asBundle(validTree([bare], { packs: [pack({ body: introOnly })] }))), "no-sources")).toHaveLength(1);
  });

  it("stale: time-sensitive facts at or past the freshness window", () => {
    const src = [{ title: "S", url: "https://s.example", note: null, line: 90 }];
    const s = skill("b.one", { ranks: [rank(1, [timeSensitive()])], factsAsOf: "2026-01-01", sources: src });
    const t = validTree([s]);
    expect(only(run(t, { today: "2026-03-31" }), "stale")).toEqual([]); // 89 days
    const stale = only(run(t, { today: "2026-04-01" }), "stale"); // exactly 90 days
    expect(stale).toHaveLength(1);
    expect(stale[0].message).toContain("was checked 90 days ago (as of 2026-01-01; stale after 90)");
    expect(stale[0].message).toContain('re-check "Check whether it shipped on mainnet." and update the as-of date');
    expect(only(run(t, { today: "2026-01-11", freshnessDays: 10 }), "stale")).toHaveLength(1);
  });

  it("stale: an item's As of overrides the skill date and locates the warning", () => {
    const ts = timeSensitive({ asOf: "2026-03-01", fields: [{ label: "As of", text: "2026-03-01", line: 555 }] });
    const s = skill("b.one", { ranks: [rank(1, [ts])], factsAsOf: TODAY, sources: [{ title: "S", url: "u", note: null, line: 9 }] });
    const stale = only(run(validTree([s])), "stale");
    expect(stale).toEqual([expect.objectContaining({ line: 555, itemId: ts.id })]);
    expect(stale[0].message).toContain("206 days ago");
  });

  it("item-size: required items under 10 min or over 2 h", () => {
    const sizes = (minutes: number, extra: Parameters<typeof item>[0] = {}) =>
      only(run(withItems([item({ minutes, ...extra })], { estimate: { text: "", hours: minutes / 60, optionalHours: null } })), "item-size");
    expect(sizes(10)).toEqual([]);
    expect(sizes(120)).toEqual([]);
    expect(sizes(5)[0].message).toContain("takes 5 min — items should take 10 min to 2 h; merge it");
    expect(sizes(121)[0].message).toContain("split it into smaller items");
    expect(only(run(withItems([item(), item({ minutes: 5, optional: true }), habit({ minutes: 5 })])), "item-size")).toEqual([]);
  });

  it("rank-size: required minutes outside 1–5 h, skipping ranks with no required items", () => {
    const small = rank(1, [item({ minutes: 45 })], { line: 77 });
    const diags = only(run(validTree([skill("b.one", { ranks: [small], estimate: { text: "", hours: 0.75, optionalHours: null } })])), "rank-size");
    expect(diags).toEqual([expect.objectContaining({ line: 77 })]);
    expect(diags[0].message).toContain("Rank 1 of b.one takes 45 min of required work — ranks should be 1 h–5 h");
    const big = rank(1, [item({ minutes: 120 }), item({ minutes: 120 }), item({ minutes: 61 })]);
    expect(only(run(validTree([skill("b.one", { ranks: [big], estimate: { text: "", hours: 5, optionalHours: null } })])), "rank-size")).toHaveLength(1);
    const onlyOptional = rank(2, [item({ optional: true, minutes: 20 })]);
    expect(only(run(validTree([skill("b.one", { ranks: [rank(1), onlyOptional] })])), "rank-size")).toEqual([]);
  });

  it("recall-too-many: more than 5 questions", () => {
    expect(only(run(validTree([skill("b.one", { recall: recall(5) })])), "recall-too-many")).toEqual([]);
    const six = recall(6);
    expect(only(run(validTree([skill("b.one", { recall: six })])), "recall-too-many")).toEqual([
      expect.objectContaining({ line: six[5].line }),
    ]);
  });

  it("branch-too-small: fewer than 3 skills", () => {
    const t = validTree([skill("c.one"), skill("c.two")]);
    const diags = only(run(t), "branch-too-small");
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('Branch "c" has 2 skills');
  });

  it("weekly-habit-in-skill: weekly habits belong in quest maintenance", () => {
    const weekly = habit({ cadence: { unit: "week", times: 2, text: "2× week" } });
    const diags = only(run(withItems([item(), weekly])), "weekly-habit-in-skill");
    expect(diags).toEqual([expect.objectContaining({ itemId: weekly.id })]);
    expect(diags[0].message).toContain("repeats 2× week");
    expect(only(run(withItems([item(), habit({ cadence: MONTHLY })])), "weekly-habit-in-skill")).toEqual([]);
    const q = quest("quest-q", { maintenance: maintenance([habit({ cadence: WEEKLY })]) });
    expect(only(run(validTree([], { quests: [q] })), "weekly-habit-in-skill")).toEqual([]);
  });

  it("habit-no-cadence: in skills and in maintenance without a section cadence", () => {
    expect(only(run(withItems([item(), habit({ cadence: null })])), "habit-no-cadence")).toHaveLength(1);
    const inherits = quest("quest-q", { maintenance: maintenance([habit({ cadence: null })]) });
    expect(only(run(validTree([], { quests: [inherits] })), "habit-no-cadence")).toEqual([]);
    const none = quest("quest-q", { maintenance: maintenance([habit({ cadence: null })], { cadence: null }) });
    expect(only(run(validTree([], { quests: [none] })), "habit-no-cadence")).toEqual([
      expect.objectContaining({ questId: "quest-q" }),
    ]);
  });

  it("unknown-resource-type: a typed link the spec doesn't define", () => {
    const it2 = item({ resources: [{ type: "tweet", title: "A tweet", url: "https://x.example", field: "Note" }], fields: [{ label: "Note", text: "…", line: 444 }] });
    const diags = only(run(withItems([it2])), "unknown-resource-type");
    expect(diags).toEqual([expect.objectContaining({ line: 444, itemId: it2.id })]);
    expect(diags[0].message).toContain('Unknown resource type "@tweet@" on link "A tweet"');
    expect(only(run(withItems([item({ resources: [resource("podcast")] })])), "unknown-resource-type")).toEqual([]);
  });

  it("unknown-key: extra metadata on skills, branches and quests", () => {
    const t = validTree([skill("b.one", { extraMeta: { requirez: "b.two" } })], {
      quests: [quest("quest-q", { extraMeta: { owner: "me" } })],
    });
    t.branches[0] = { ...t.branches[0], extraMeta: { colour: "#fff" } };
    const diags = only(run(t), "unknown-key");
    expect(diags.map((d) => d.message)).toEqual([
      expect.stringContaining('Unknown branch key "colour" (did you mean "color"?)'),
      expect.stringContaining('Unknown skill key "requirez" (did you mean "requires"?)'),
      expect.stringContaining('Unknown quest key "owner" — it\'s kept but ignored'),
    ]);
  });
});

describe("validate: sorting and summary", () => {
  it("sorts by file, then line, then severity", () => {
    const d = (file: string | undefined, line: number | undefined, severity: "error" | "warning", code: string): Diagnostic => ({
      severity,
      code,
      message: code,
      ...(file === undefined ? {} : { file }),
      ...(line === undefined ? {} : { line }),
    });
    const sorted = sortDiagnostics([
      d("b.md", 1, "warning", "w-b1"),
      d("a.md", 10, "warning", "w-a10"),
      d("a.md", 10, "error", "e-a10"),
      d("a.md", 2, "warning", "w-a2"),
      d(undefined, undefined, "warning", "no-file"),
      d("a.md", undefined, "error", "a-noline"),
    ]);
    expect(sorted.map((x) => x.code)).toEqual(["no-file", "a-noline", "w-a2", "e-a10", "w-a10", "w-b1"]);
  });

  it("returns validate() output sorted across files", () => {
    const t = validTree([skill("b.two", { why: null }), skill("b.one", { why: "Short." })]);
    const diags = run(t);
    expect(diags.map((x) => `${x.file}:${x.code}`)).toEqual([
      "content/branches/b/one.md:short-why",
      "content/branches/b/two.md:missing-why",
    ]);
  });

  it("summarizes counts by severity and code", () => {
    const diags: Diagnostic[] = [
      { severity: "error", code: "cycle", message: "x" },
      { severity: "error", code: "cycle", message: "y" },
      { severity: "warning", code: "search-links", message: "3 @search@ links to resolve into exact videos (line 1)" },
      { severity: "warning", code: "search-links", message: "1 @search@ link to resolve into exact videos (line 9)" },
      { severity: "warning", code: "stale", message: "z" },
    ];
    expect(summarize(diags)).toEqual({
      errors: 2,
      warnings: 3,
      byCode: { cycle: 2, "search-links": 2, stale: 1 },
      searchLinks: 4,
    });
    expect(summarize([])).toEqual({ errors: 0, warnings: 0, byCode: {}, searchLinks: 0 });
  });
});

// Runs against the real seed once the parser (built in parallel) exists.
const SEED = path.join(process.cwd(), "crypto-finance-the-tie.skilltree.md");
const PARSER = path.join(process.cwd(), "src/lib/content/parse-bundle.ts");

describe.skipIf(!fs.existsSync(PARSER) || !fs.existsSync(SEED))("validate: the seed bundle", () => {
  async function parseSeed(): Promise<ContentTree> {
    const mod: unknown = await import(/* @vite-ignore */ PARSER);
    const parseBundle = (mod as { parseBundle?: unknown }).parseBundle;
    if (typeof parseBundle !== "function") throw new Error("parse-bundle.ts has no parseBundle export");
    return parseBundle(fs.readFileSync(SEED, "utf8"), "crypto-finance-the-tie.skilltree.md") as ContentTree;
  }

  it("has no structural errors, and counts its 14 @search@ links", async () => {
    const diags = run(await parseSeed());
    const summary = summarize(diags);
    for (const code of ["duplicate-id", "unresolved-ref", "cycle", "quest-order", "missing-item-id", "path-mismatch", "missing-why", "recall-too-few"]) {
      expect(summary.byCode[code] ?? 0, code).toBe(0);
    }
    expect(summary.searchLinks).toBe(14);
    expect(only(diags, "item-missing-time").map((d) => d.message)).toContainEqual(
      expect.stringContaining("Optional: SR's Staking Insider"),
    );
  });

  it("goes stale exactly 90 days after its facts_as_of", async () => {
    const seed = await parseSeed();
    expect(only(run(seed, { today: "2026-12-21" }), "stale")).toEqual([]);
    expect(only(run(seed, { today: "2026-12-22" }), "stale").length).toBeGreaterThan(0);
  });
});
