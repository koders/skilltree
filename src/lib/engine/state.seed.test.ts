// Integration against the real seed. Part one uses three skills
// (crypto.consensus → crypto.eth-validators → crypto.staking-metrics)
// hand-mirrored as a ContentTree JSON fixture, so it doesn't need the parser.
// Part two runs the whole bundle through the real parser and id assignment,
// the way `pnpm content:import` feeds the app. The engine itself never
// imports the parser; only this test does.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assignMissingIds } from "@/lib/content/ids";
import { parseBundle } from "@/lib/content/parse-bundle";
import { indexContent, type ContentIndex, type ContentTree, type Item } from "@/lib/content/types";
import {
  habitLog,
  itemRow,
  learnedRow,
  makeSnapshot,
  skillRow,
  testOutSession,
  timeLog,
  verification,
} from "@/lib/engine/__fixtures__/content";
import { computeHabits } from "@/lib/engine/habits";
import { computeTreeState } from "@/lib/engine/state";
import type { ProgressSnapshot } from "@/lib/progress/types";

const TODAY = "2026-09-23";
const FIXTURE = path.join(process.cwd(), "src/lib/engine/__fixtures__/seed-crypto-skills.json");
const SEED = path.join(process.cwd(), "seed/crypto-finance-the-tie.skilltree.md");

function isContentTree(value: unknown): value is ContentTree {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.skills) && Array.isArray(v.branches) && Array.isArray(v.quests) && (v.shape === "tree" || v.shape === "bundle");
}

function loadIndex(): ContentIndex {
  const parsed: unknown = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  if (!isContentTree(parsed)) throw new Error("fixture is not a ContentTree");
  return indexContent(parsed);
}

const CONSENSUS = "crypto.consensus";
const ETH = "crypto.eth-validators";
const METRICS = "crypto.staking-metrics";

describe("seed fixture", () => {
  it("mirrors the seed bundle's titles, requires and Recall", () => {
    const seed = fs.readFileSync(SEED, "utf8");
    const index = loadIndex();
    for (const skill of Object.values(index.skills)) {
      expect(seed).toContain(`## ${skill.title}\n- id: ${skill.id}\n- requires: ${skill.requires.join(", ") || "—"}\n`);
      for (const q of skill.recall) expect(seed).toContain(`- ${q.text}\n`);
      for (const item of skill.ranks.flatMap((r) => r.items)) expect(seed).toContain(`[${item.type}] ${item.title} — ${item.timeText}`);
    }
  });
});

describe("seed: test out of consensus", () => {
  const index = loadIndex();
  const state = (snapshot: Partial<ProgressSnapshot>) => computeTreeState(index, makeSnapshot(snapshot), TODAY);
  const questionIds = index.skills[CONSENSUS].recall.map((q) => q.id);

  it("starts with only consensus available", () => {
    const t = state({});
    expect(t.skills[CONSENSUS]).toMatchObject({ state: "available", canTestOut: true });
    expect(t.skills[ETH]).toMatchObject({ state: "locked", missingRequires: [CONSENSUS], canTestOut: false });
    expect(t.skills[METRICS]).toMatchObject({ state: "locked", missingRequires: [ETH] });
    expect(t.branches.crypto).toMatchObject({ total: 3, available: 1, locked: 2, learned: 0 });
  });

  it("unlocks eth-validators once consensus is tested out", () => {
    const createdAt = "2026-09-22T18:00:00Z";
    const t = state({
      recallAttempts: testOutSession(CONSENSUS, questionIds, { sessionId: "consensus-1", createdAt }),
      skills: [learnedRow(CONSENSUS, "tested-out", createdAt)],
    });

    expect(t.skills[CONSENSUS]).toMatchObject({
      state: "tested-out",
      learned: true,
      progress: 1,
      canTestOut: false,
      lastTestOut: { at: createdAt, passed: 3, total: 3 },
      xp: 30,
      lastActivityAt: createdAt,
    });
    // A test-out clears the ranks without touching item rows (the rank counts its item as covered).
    expect(t.skills[CONSENSUS].ranks[0]).toMatchObject({ complete: true, doneCount: 1, blockingCount: 1 });
    expect(t.items[`${CONSENSUS}/roughgarden-foundations`].status).toBe("todo");

    expect(t.skills[ETH]).toMatchObject({ state: "available", locked: false, missingRequires: [], canTestOut: true });
    expect(t.skills[METRICS]).toMatchObject({ state: "locked", missingRequires: [ETH] });
    expect(t.branches.crypto).toMatchObject({ learned: 1, available: 1, locked: 1, xp: 30 });
    expect(t.xp).toMatchObject({ total: 30, recallBonus: 30, level: 1 });
  });

  it("keeps eth-validators locked after a failed test-out (no learned row)", () => {
    const t = state({ recallAttempts: testOutSession(CONSENSUS, questionIds, { failed: ["q2"] }) });
    expect(t.skills[CONSENSUS]).toMatchObject({ state: "available", lastTestOut: { passed: 2, total: 3 } });
    expect(t.skills[ETH].state).toBe("locked");
  });
});

// ---------------------------------------------------------------- the whole seed, as imported
//
// parseBundle + assignMissingIds is what `pnpm content:import` does before the
// app reads content/. Items are found by title so the test doesn't pin the
// generated ids.

describe("seed: the whole bundle through the engine", () => {
  const index = importedSeed();
  const skillItems = (skillId: string) => index.skills[skillId].ranks.flatMap((r) => r.items);
  const itemByTitle = (skillId: string, start: string): Item => {
    const found = skillItems(skillId).find((i) => i.title.startsWith(start));
    if (!found) throw new Error(`no item "${start}" in ${skillId}`);
    return found;
  };
  const timeSensitive = Object.values(index.skills).flatMap((s) => s.ranks.flatMap((r) => r.items).filter((i) => i.timeSensitive));
  const run = (snapshot: Partial<ProgressSnapshot> = {}, today = TODAY) => computeTreeState(index, makeSnapshot(snapshot), today);

  it("gives every content item its own view (nothing collapses or goes missing)", () => {
    const contentItems = [
      ...Object.values(index.skills).flatMap((s) => s.ranks.flatMap((r) => r.items)),
      ...Object.values(index.quests).flatMap((q) => q.maintenance?.items ?? []),
    ];
    expect(contentItems.every((i) => i.id !== "")).toBe(true);
    const t = run();
    expect(Object.keys(t.items).sort()).toEqual(contentItems.map((i) => i.key).sort());
    expect(Object.keys(t.skills)).toHaveLength(24);
  });

  it("starts with the starting skills learned and only root skills available", () => {
    const t = run();
    const byState = (state: string) => Object.values(t.skills).filter((s) => s.state === state).map((s) => s.id).sort();
    expect(byState("self-reported")).toEqual(["swe.claude-code", "swe.graphql", "swe.nextjs", "swe.react", "swe.web3-frontend"]);
    // Market Intelligence requires nothing itself, but both its ranks do: nothing in it is workable yet.
    expect(byState("available")).toEqual(["crypto.consensus", "finance.money-settlement"]);
    expect(byState("locked")).toHaveLength(24 - 5 - 2);
    expect(Object.fromEntries(Object.values(t.branches).map((b) => [b.id, b.total]))).toEqual({ swe: 5, finance: 6, crypto: 13 });
    expect(t.branches.swe).toMatchObject({ learned: 5, progress: 1 });
  });

  it("lets time-sensitive facts (as of 2026-09-23) go stale on day 90, 2026-12-22", () => {
    expect(timeSensitive.length).toBeGreaterThanOrEqual(5);
    const before = run({}, "2026-12-21");
    const owners = [...new Set(timeSensitive.map((i) => i.ownerId))];
    for (const id of owners) expect(before.skills[id].rust).toMatchObject({ stale: [], nextStaleOn: "2026-12-22" });

    const onTheDay = run({}, "2026-12-22");
    const stale = Object.values(onTheDay.skills).flatMap((s) => s.rust.stale.map((x) => x.itemKey));
    expect(stale.sort()).toEqual(timeSensitive.map((i) => i.key).sort());
    // Unlearned skills carry the flag without turning rusty.
    expect(Object.values(onTheDay.skills).some((s) => s.state === "rusty")).toBe(false);
  });

  it("turns a learned Cosmos skill rusty on day 90, and a re-verification clears it", () => {
    const cosmos = "crypto.cosmos-staking";
    const facts = [itemByTitle(cosmos, "ATOM inflation"), itemByTitle(cosmos, "Governance watch")];
    const learned = [learnedRow(cosmos, "tested-out", "2026-10-01T10:00:00Z")];
    expect(run({ skills: learned }, "2026-12-21").skills[cosmos].state).toBe("tested-out");
    expect(run({ skills: learned }, "2026-12-22").skills[cosmos]).toMatchObject({ state: "rusty", learned: true });

    const verified = facts.map((f) => verification(cosmos, f.id, "2026-12-22T08:00:00Z"));
    const t = run({ skills: learned, verifications: verified }, "2026-12-22");
    expect(t.skills[cosmos].state).toBe("tested-out");
    expect(t.items[facts[0].key]).toMatchObject({ asOf: "2026-12-22", lastVerifiedAt: "2026-12-22", staleOn: "2027-03-22" });
    // A learned skill is never locked, even with its own requires still unlearned.
    expect(t.skills[cosmos]).toMatchObject({ locked: false, missingRequires: ["crypto.consensus", "crypto.staking-metrics"] });

    // "It changed" means the content is now wrong: the skill stays rusty until the file is fixed.
    const changed = facts.map((f) => verification(cosmos, f.id, "2026-12-23T08:00:00Z", true));
    const c = run({ skills: learned, verifications: changed }, "2026-12-23");
    expect(c.skills[cosmos].state).toBe("rusty");
    expect(c.items[facts[0].key]).toMatchObject({ stale: true, changedOn: "2026-12-23", staleOn: "2026-12-22" });
  });

  it("gates Market Intelligence rank by rank, and only completes it once both ranks unlock", () => {
    const mi = "finance.market-intelligence";
    const allDone = skillItems(mi).filter((i) => i.type !== "habit" && !i.optional).map((i) => itemRow(mi, i.id));
    const locked = run({ items: allDone }).skills[mi];
    expect(locked.ranks.map((r) => r.missingRequires)).toEqual([["crypto.staking-metrics"], ["finance.market-structure"]]);
    expect(locked).toMatchObject({ ranksComplete: 2, readyToComplete: false, canTestOut: false });

    const unlocked = run({
      items: allDone,
      skills: [learnedRow("crypto.staking-metrics", "tested-out"), learnedRow("finance.market-structure", "tested-out")],
    }).skills[mi];
    expect(unlocked.ranks.every((r) => !r.locked)).toBe(true);
    expect(unlocked.readyToComplete).toBe(true);
  });

  it("locks Market Intelligence while every rank is locked, even though the skill itself requires nothing", () => {
    const mi = "finance.market-intelligence";
    // Day one: nothing in it can be worked, so no "Start skill", no test-out, not counted as available.
    expect(run().skills[mi]).toMatchObject({
      state: "locked",
      locked: true,
      missingRequires: ["crypto.staking-metrics"],
      canTestOut: false,
    });
    // An earlier "Start skill" doesn't make it workable either.
    expect(run({ skills: [skillRow(mi, { startedAt: "2026-09-22T10:00:00Z" })] }).skills[mi]).toMatchObject({ state: "locked", locked: true });
    expect(Object.values(run().skills).filter((s) => s.state === "available").map((s) => s.id).sort()).toEqual([
      "crypto.consensus",
      "finance.money-settlement",
    ]);

    // Staking Metrics learned: Rank 1 opens; Rank 2 still waits on Market Structure.
    const metrics = [learnedRow("crypto.staking-metrics", "tested-out")];
    const open = run({ skills: metrics }).skills[mi];
    expect(open).toMatchObject({ state: "available", locked: false, missingRequires: [] });
    expect(open.ranks.map((r) => r.locked)).toEqual([false, true]);
    // A test-out clears every rank, so like the completion check it waits for every rank's requires.
    expect(open.canTestOut).toBe(false);
    const both = run({ skills: [...metrics, learnedRow("finance.market-structure", "tested-out")] }).skills[mi];
    expect(both.canTestOut).toBe(true);
  });

  it("keeps Chains and Infrastructure's monthly/annual habits out of rank progress, and credits their time", () => {
    const infra = "crypto.infrastructure";
    const monthly = itemByTitle(infra, "Technical depth");
    const annual = itemByTitle(infra, "Annual big-picture");
    // Rank 1: L2Beat (do) + Bridges and oracles (read) block; the two habits don't.
    expect(skillItems(infra).filter((i) => i.type === "habit")).toEqual([monthly, annual]);
    expect(run().skills[infra].ranks[0]).toMatchObject({ blockingCount: 2, doneCount: 0 });

    const started = { skills: [learnedRow("crypto.consensus", "tested-out")], items: [itemRow(infra, itemByTitle(infra, "L2Beat").id)] };
    const idle = computeHabits(index, makeSnapshot(), run(), {}, TODAY).filter((h) => h.ownerId === infra);
    expect(idle.map((h) => [h.key, h.cadence.unit, h.active])).toEqual([
      [monthly.key, "month", false],
      [annual.key, "year", false],
    ]);

    const snap = makeSnapshot({
      ...started,
      habitLogs: [habitLog(monthly.key, "2026-09-01", "2026-09-22")],
      timeLogs: [timeLog({ habitKey: monthly.key, activity: "habit", minutes: 50, loggedOn: "2026-09-22" })],
    });
    const t = computeTreeState(index, snap, TODAY);
    const active = computeHabits(index, snap, t, {}, TODAY).filter((h) => h.ownerId === infra);
    expect(active.map((h) => h.active)).toEqual([true, true]);
    expect(active[0]).toMatchObject({ complete: true, doneThisPeriod: 1, periodStart: "2026-09-01" });
    expect(t.skills[infra]).toMatchObject({ state: "in-progress", minutesLogged: 50, xp: 50 });
    expect(t.skills[infra].ranks[0]).toMatchObject({ doneCount: 1, complete: false });
  });

  it("switches the quest's weekly maintenance on in week 13", () => {
    const quest = "quest-crypto-finance-the-tie";
    const questHabits = (week: number) =>
      computeHabits(index, makeSnapshot(), run(), { [quest]: week }, TODAY).filter((h) => h.ownerId === quest);
    expect(questHabits(12)).toHaveLength(6);
    expect(questHabits(12).every((h) => !h.active && h.inactiveReason === "Starts in quest week 13")).toBe(true);
    expect(questHabits(13).every((h) => h.active)).toBe(true);
    const terminal = questHabits(13).find((h) => h.title.startsWith("Terminal, 10 min twice a week"));
    expect(terminal).toMatchObject({ target: 2, cadence: { unit: "week", times: 2 } });
  });
});

function importedSeed(): ContentIndex {
  const tree = assignMissingIds(parseBundle(fs.readFileSync(SEED, "utf8"), SEED));
  expect(tree.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return indexContent(tree);
}
