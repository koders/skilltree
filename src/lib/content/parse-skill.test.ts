import { describe, expect, it } from "vitest";
import { parseBundle } from "@/lib/content/parse-bundle";
import { parseItemHeader, splitLabel } from "@/lib/content/parse-items";
import { parseMaintenanceHeading, parsePace } from "@/lib/content/parse-quest";
import { parseQuestFile, parseSkillFile } from "@/lib/content/parse-tree";
import type { Diagnostic } from "@/lib/content/types";

const FILE = "content/branches/crypto/demo.md";

function parse(text: string) {
  const diagnostics: Diagnostic[] = [];
  const skill = parseSkillFile(text, FILE, diagnostics);
  if (!skill) throw new Error("no skill");
  return { skill, diagnostics };
}

const messages = (ds: Diagnostic[]) => ds.map((d) => `${d.line}: ${d.message}`);

describe("parseItemHeader", () => {
  it("parses checkbox, type, flags, title, time and id", () => {
    expect(parseItemHeader("[x] [read] [time-sensitive] [optional] A — B — ~1 h 30 min at 2x {#a-b}")).toMatchObject({
      checked: true,
      type: "read",
      rawType: "read",
      timeSensitive: true,
      optionalFlag: true,
      title: "A — B",
      timeText: "~1 h 30 min at 2x",
      minutes: 90,
      id: "a-b",
      problems: [],
    });
  });

  it("accepts en dash and hyphen separators, and times without a tilde", () => {
    expect(parseItemHeader("[do] Thing – ~20 min")).toMatchObject({ title: "Thing", minutes: 20 });
    expect(parseItemHeader("[do] Thing - 45 min")).toMatchObject({ title: "Thing", minutes: 45, timeText: "45 min" });
  });

  it("does not split on a dash followed by a number that isn't a duration", () => {
    expect(parseItemHeader("[read] Round 2 — 5 lessons")).toMatchObject({ title: "Round 2 — 5 lessons", timeText: null });
    expect(parseItemHeader("[watch] 1–2 Lightspeed episodes — ~1 h")).toMatchObject({ title: "1–2 Lightspeed episodes", minutes: 60 });
  });

  it("takes an id written before the time instead of leaving it in the title", () => {
    expect(parseItemHeader("[read] Thing {#thing} — ~10 min")).toMatchObject({ title: "Thing", id: "thing", minutes: 10, problems: [] });
    // A trailing id still wins, and an id-looking text mid-title is left alone.
    expect(parseItemHeader("[read] A {#a} — ~10 min {#b}")).toMatchObject({ title: "A {#a}", id: "b" });
    expect(parseItemHeader("[read] Use {#x} syntax here — ~10 min")).toMatchObject({ title: "Use {#x} syntax here", id: "" });
  });

  it("keeps a title that starts with a link", () => {
    expect(parseItemHeader("[read] [Money Stuff](https://x.io) issues — ~1 h").title).toBe("[Money Stuff](https://x.io) issues");
  });

  it("reports missing and unknown types, unknown flags and bad times", () => {
    expect(parseItemHeader("[ ] Just a title — ~10 min").problems).toEqual([expect.stringMatching(/no type/)]);
    expect(parseItemHeader("[ ] [time-sensitive] Title — ~10 min")).toMatchObject({ type: null, rawType: null, timeSensitive: true });
    expect(parseItemHeader("[lecture] Title — ~10 min")).toMatchObject({ type: null, rawType: "lecture" });
    expect(parseItemHeader("[read] [draft] Title — ~10 min").problems).toEqual([expect.stringMatching(/Unknown item flag/)]);
    expect(parseItemHeader("[read] Title — ~soon")).toMatchObject({ timeText: "~soon", minutes: null, problems: [expect.stringMatching(/Unparseable time/)] });
  });
});

describe("splitLabel", () => {
  it.each([
    ["Done when: I can explain X.", "Done when", "I can explain X."],
    ["Case study: on Oct 10, 2025, things", "Case study", "on Oct 10, 2025, things"],
    ["Do:", "Do", ""],
    ["plain note: lower-case start", "", "plain note: lower-case start"],
    ["[@tool@X](https://x.io): a tool", "", "[@tool@X](https://x.io): a tool"],
    ["At 10:30 do X", "", "At 10:30 do X"],
    ["This label is far too long to be a label: text", "", "This label is far too long to be a label: text"],
    // Known labels count whatever their case, so "done when:" isn't silently a plain note.
    ["done when: I can explain X.", "done when", "I can explain X."],
    ["if stuck: ask", "if stuck", "ask"],
    ["VERIFY: the rate", "VERIFY", "the rate"],
    ["resource:", "resource", ""],
  ])("%j", (text, label, rest) => {
    expect(splitLabel(text)).toEqual({ label, text: rest });
  });
});

describe("parseSkillBlock (tree shape)", () => {
  it("parses a full skill file with ids, fields, continuation lines and sections", () => {
    const { skill, diagnostics } = parse(`# Demo skill
- id: crypto.demo
- requires: crypto.a, crypto.b
- related: finance.c
- estimate: ~2 h
- facts_as_of: 2026-09-01
- owner_note: hello

Why: because it matters for the demo.

A free description paragraph.

## Rank 1 — Basics
- requires: finance.c
- [ ] [build] Build it — ~1 h {#build-it}
  - Do: step one
    - nested detail
    more detail
  - If stuck: ask.
  - As of: 2026-08-01
  - An unlabeled note
- [ ] [habit] Review monthly — ~15 min {#review}
  - Cadence: twice a month

## Recall
- First? {#q1}
- Second
  continued? {#q2}

## Sources
- [Doc](https://doc.io) — as of 2026-09-01
- [Other](https://other.io)

## Notes
Some text.

### Sub heading

## Review log
- Round 1: created.
`);
    expect(diagnostics).toEqual([]);
    expect(skill).toMatchObject({
      id: "crypto.demo",
      branchId: "crypto",
      slug: "demo",
      requires: ["crypto.a", "crypto.b"],
      related: ["finance.c"],
      factsAsOf: "2026-09-01",
      why: "because it matters for the demo.",
      description: "A free description paragraph.",
      extraMeta: { owner_note: "hello" },
      reviewLog: "- Round 1: created.",
      file: FILE,
      line: 1,
    });
    const [build, habit] = skill.ranks[0].items;
    expect(skill.ranks[0]).toMatchObject({ number: 1, name: "Basics", requires: ["finance.c"], line: 13 });
    expect(build.fields).toEqual([
      { label: "Do", text: "step one\n- nested detail\nmore detail", line: 16 },
      { label: "If stuck", text: "ask.", line: 19 },
      { label: "As of", text: "2026-08-01", line: 20 },
      { label: "", text: "An unlabeled note", line: 21 },
    ]);
    expect(build).toMatchObject({ key: "crypto.demo/build-it", do: "step one\n- nested detail\nmore detail", asOf: "2026-08-01", cadence: null });
    expect(habit.cadence).toEqual({ unit: "month", times: 2, text: "2× month" });
    expect(skill.recall).toEqual([
      { id: "q1", text: "First?", line: 26 },
      { id: "q2", text: "Second continued?", line: 27 },
    ]);
    expect(skill.sources).toEqual([
      { title: "Doc", url: "https://doc.io", note: "as of 2026-09-01", line: 31 },
      { title: "Other", url: "https://other.io", note: null, line: 32 },
    ]);
    expect(skill.sections).toEqual([{ heading: "Notes", body: "Some text.\n\n### Sub heading", line: 34 }]);
  });

  it("skill habits with nothing inferable have no cadence", () => {
    const { skill } = parse("# S\n- id: crypto.s\n- requires: —\n\n## Rank 1\n- [ ] [habit] Read things — ~10 min\n");
    expect(skill.ranks[0].items[0].cadence).toBeNull();
  });

  it("falls back to the path-derived id when id is missing", () => {
    const { skill, diagnostics } = parse("# No id\n- requires: —\n");
    expect(skill.id).toBe("crypto.demo");
    expect(messages(diagnostics)).toEqual([expect.stringMatching(/^1: .*has no "- id:"/)]);
  });

  it("reports structural problems with file and line", () => {
    const { diagnostics } = parse(`# Broken
- id: crypto.broken
- requires: —
- estimate: soon
- facts_as_of: 2026-13-01
- id: crypto.again

## Rank 2
- [ ] Missing type — ~10 min
- [ ] [lecture] Unknown type — ~10 min
- [ ] [read] Bad time — ~a while
Stray paragraph in a rank.
- requires: crypto.late
- [ ] [read] Bad date — ~10 min
  - As of: yesterday

## Rank 1

## Rank one

## Recall
Not a bullet

## Sources
- No link here
`);
    expect(diagnostics.every((d) => d.severity === "error" && d.code === "parse" && d.file === FILE)).toBe(true);
    expect(diagnostics.every((d) => d.skillId === "crypto.broken" || d.line === 6)).toBe(true);
    expect(messages(diagnostics)).toEqual([
      expect.stringMatching(/^6: Duplicate metadata key "id"/),
      expect.stringMatching(/^4: Unparseable estimate "soon"/),
      expect.stringMatching(/^5: Invalid facts_as_of "2026-13-01"/),
      expect.stringMatching(/^9: Item has no type/),
      expect.stringMatching(/^10: Unknown item type "\[lecture\]"/),
      expect.stringMatching(/^11: Unparseable time "~a while"/),
      expect.stringMatching(/^12: Expected an item bullet/),
      expect.stringMatching(/^13: "- requires:" must come before/),
      expect.stringMatching(/^15: Invalid date "yesterday" in As of/),
      expect.stringMatching(/^8: "Rank 2" is out of order; expected Rank 1/),
      expect.stringMatching(/^17: "Rank 1" is out of order; expected Rank 2/),
      expect.stringMatching(/^19: Malformed rank heading "Rank one"/),
      expect.stringMatching(/^22: Expected a recall question bullet/),
      expect.stringMatching(/^25: A source must start with a markdown link/),
    ]);
  });

  it("flags rank headings at the wrong level and stray text before the title", () => {
    const { diagnostics } = parse("stray\n# S\n- id: crypto.s\n- requires: —\n\n### Rank 1\n");
    expect(messages(diagnostics)).toEqual([
      expect.stringMatching(/^1: Unexpected text before the "# Title" heading/),
      expect.stringMatching(/^6: "Rank 1" must be a ## heading/),
    ]);
  });

  it("flags a second # heading", () => {
    const { diagnostics } = parse("# A\n- id: crypto.a\n- requires: —\n\n# B\n");
    expect(messages(diagnostics)).toEqual([expect.stringMatching(/^5: Only one # heading/)]);
  });

  it("ignores headings and bullets inside fenced code", () => {
    const { skill, diagnostics } = parse("# S\n- id: crypto.s\n- requires: —\n\n## Notes\n```\n# not a heading\n- not a bullet\n```\n");
    expect(diagnostics).toEqual([]);
    expect(skill.sections[0].body).toBe("```\n# not a heading\n- not a bullet\n```");
  });

  it("reads a rank's requires whatever the key's case", () => {
    const { skill, diagnostics } = parse("# S\n- id: crypto.s\n- requires: —\n\n## Rank 1\n- Requires: crypto.a\n- [ ] [do] D — ~1 h {#d}\n");
    expect(diagnostics).toEqual([]);
    expect(skill.ranks[0]).toMatchObject({ requires: ["crypto.a"], items: [expect.objectContaining({ id: "d" })] });
  });

  it("fills convenience fields from lower-case known labels", () => {
    const { skill, diagnostics } = parse(
      "# S\n- id: crypto.s\n- requires: —\n\n## Rank 1\n- [ ] [build] [time-sensitive] B — ~1 h\n  - done when: I can show the chart to someone.\n  - if stuck: ask.\n  - verify: the rate.\n",
    );
    expect(diagnostics).toEqual([]);
    expect(skill.ranks[0].items[0]).toMatchObject({
      doneWhen: "I can show the chart to someone.",
      ifStuck: "ask.",
      verify: "the rate.",
    });
  });

  it("keeps blank lines inside a multi-paragraph field", () => {
    const { skill, diagnostics } = parse(
      "# S\n- id: crypto.s\n- requires: —\n\n## Rank 1\n- [ ] [do] D — ~1 h {#d}\n  - Do: step one\n\n    step two\n\n\n    step three\n\n  - Note: n\n\n- [ ] [do] E — ~1 h {#e}\n",
    );
    expect(diagnostics).toEqual([]);
    const [d, e] = skill.ranks[0].items;
    expect(d.fields).toEqual([
      { label: "Do", text: "step one\n\nstep two\n\n\nstep three", line: 7 },
      { label: "Note", text: "n", line: 14 },
    ]);
    expect(e.id).toBe("e");
  });

  it("reports an explicit Cadence it can't read instead of silently using the fallback", () => {
    const { skill, diagnostics } = parse(
      "# S\n- id: crypto.s\n- requires: —\n\n## Rank 1\n- [ ] [habit] Check monthly — ~10 min {#h}\n  - Cadence: fortnightly\n- [ ] [read] Not a habit — ~10 min {#r}\n  - Cadence: whenever\n",
    );
    expect(messages(diagnostics)).toEqual([expect.stringMatching(/^7: Unparseable cadence "fortnightly"/)]);
    expect(diagnostics[0]).toMatchObject({ skillId: "crypto.s", itemId: "h" });
    expect(skill.ranks[0].items[1].cadence).toBeNull();
  });

  it("applies a Sources heading's as-of date to undated sources", () => {
    const { skill, diagnostics } = parse(
      "# S\n- id: crypto.s\n- requires: —\n\n## Sources (checked as of 2026-01-02)\n- [A](https://a.io)\n- [B](https://b.io) — as of 2026-03-04\n",
    );
    expect(diagnostics).toEqual([]);
    expect(skill.sources.map((s) => s.note)).toEqual(["as of 2026-01-02", "as of 2026-03-04"]);
  });
});

describe("quest parsing", () => {
  const QUEST = `# Demo quest
- id: quest-demo
- pace: 6 weeks, ~3 h/week

| Weeks | Stage | Skills |
| --- | --- | --- |
| 1 | One | a.x -> a.y (Ranks 1, 3), a.z |
| 2–4 | Two | a.w (Rank 2) |

Extra paragraph.

## Maintenance (2x month, from week 5, ~1–2 h/week)

Intro.

- [ ] [habit] Thing — ~10 min

## Review log
Done.
`;

  it("parses pace, steps, maintenance and kept sections", () => {
    const ds: Diagnostic[] = [];
    const q = parseQuestFile(QUEST, "content/quests/demo.md", ds);
    expect(ds).toEqual([]);
    expect(q).toMatchObject({ weeks: 6, hoursPerWeek: { min: 3, max: 3 }, reviewLog: "Done." });
    expect(q?.stages[0].steps).toEqual([
      { skillId: "a.x", ranks: null, text: "a.x" },
      { skillId: "a.y", ranks: [1, 3], text: "a.y (Ranks 1, 3)" },
      { skillId: "a.z", ranks: null, text: "a.z" },
    ]);
    expect(q?.stages.map((s) => [s.weekStart, s.weekEnd])).toEqual([
      [1, 1],
      [2, 4],
    ]);
    expect(q?.sections).toEqual([{ heading: "", body: "Extra paragraph.", line: 10 }]);
    expect(q?.maintenance).toMatchObject({ fromWeek: 5, hoursPerWeek: 2, description: "Intro.", cadence: { unit: "month", times: 2 } });
    expect(q?.maintenance?.items[0].cadence).toEqual({ unit: "month", times: 2, text: "2× month" });
  });

  it("reports a malformed stage table", () => {
    const ds: Diagnostic[] = [];
    parseQuestFile("# Q\n- id: quest-q\n\n| Weeks | Name |\n| --- | --- |\n| 1 | x |\n", "content/quests/q.md", ds);
    expect(messages(ds)).toEqual([expect.stringMatching(/^4: Malformed stage table: it needs Weeks, Stage and Skills/)]);
    const ds2: Diagnostic[] = [];
    parseQuestFile(
      "# Q\n- id: quest-q\n\n| Weeks | Stage | Skills |\n| --- | --- | --- |\n| soon | x | a.b |\n| 1 | y | a.b (Rank x) |\n| 2 | z |\n",
      "content/quests/q.md",
      ds2,
    );
    expect(ds2.every((d) => d.questId === "quest-q")).toBe(true);
    expect(messages(ds2)).toEqual([
      expect.stringMatching(/^6: Unparseable weeks "soon"/),
      expect.stringMatching(/^7: Unparseable quest step "a.b \(Rank x\)"/),
      expect.stringMatching(/^8: Malformed stage table row/),
    ]);
  });

  const questWith = (table: string) => {
    const ds: Diagnostic[] = [];
    const q = parseQuestFile(`# Q\n- id: quest-q\n- pace: 12-week plan, 4 h/week\n\n${table}\n`, "content/quests/q.md", ds);
    return { q, ds };
  };

  it("rejects week ranges that run backwards or start before week 1", () => {
    const { q, ds } = questWith("| Weeks | Stage | Skills |\n| --- | --- | --- |\n| 3–1 | A | a.b |\n| 0 | B | a.c |\n| 0+ | C | a.d |\n| 2 | D | a.e |");
    expect(messages(ds)).toEqual([
      expect.stringMatching(/^7: Unparseable weeks "3–1"/),
      expect.stringMatching(/^8: Unparseable weeks "0"/),
      expect.stringMatching(/^9: Unparseable weeks "0\+"/),
    ]);
    expect(q?.stages.map((s) => s.name)).toEqual(["D"]);
  });

  it("rejects rank limits below 1", () => {
    const { ds } = questWith("| Weeks | Stage | Skills |\n| --- | --- | --- |\n| 1 | A | a.b (Rank 0) |");
    expect(messages(ds)).toEqual([expect.stringMatching(/^7: Unparseable quest step "a.b \(Rank 0\)"/)]);
  });

  it("reports stage table columns the format can't store instead of dropping them", () => {
    const { q, ds } = questWith("| Weeks | Stage | Skills | Hours |\n| --- | --- | --- | --- |\n| 1 | A | a.b | 5 |");
    expect(messages(ds)).toEqual([expect.stringMatching(/^5: Stage table column "Hours" isn't part of the format/)]);
    expect(q?.stages).toHaveLength(1);
  });

  it("reports a stage table glued to a paragraph, and a quest without one", () => {
    const glued = questWith("Stages:\n| Weeks | Stage | Skills |\n| --- | --- | --- |\n| 1 | A | a.b |");
    expect(messages(glued.ds)).toEqual([expect.stringMatching(/^6: Malformed stage table: .*blank line/)]);
    const none = questWith("Just prose.");
    expect(messages(none.ds)).toEqual([expect.stringMatching(/^1: Quest "Q" has no stage table/)]);
    expect(none.ds[0].questId).toBe("quest-q");
  });

  it("reads 'N-week' paces", () => {
    const { q } = questWith("| Weeks | Stage | Skills |\n| --- | --- | --- |\n| 1 | A | a.b |");
    expect(q).toMatchObject({ weeks: 12, hoursPerWeek: { min: 4, max: 4 } });
  });

  it("orders an hours range written high-to-low", () => {
    expect(parsePace("5–4 h/week").hoursPerWeek).toEqual({ min: 4, max: 5 });
    expect(parseMaintenanceHeading("Maintenance (weekly, 3–2 h/week)").hoursPerWeek).toBe(3);
  });
});

describe("bundle structure", () => {
  it("closes branches at --- and sends later ## sections to the pack", () => {
    const tree = parseBundle(
      `---
id: p
facts_as_of: 2026-02-03
---

# Intro

Hello.

# Branch: B

- id: b
- color: #38bdf8
- order: 2

Branch description.

## S1
- id: b.s1
- requires: —
- facts_as_of: 2026-01-01

### Notes

#### Deep

---

## Pack section

After the break.
`,
      "p.skilltree.md",
    );
    expect(tree.diagnostics).toEqual([]);
    expect(tree.branches[0]).toMatchObject({ id: "b", color: "#38bdf8", order: 2, description: "Branch description.", skillIds: ["b.s1"] });
    expect(tree.skills[0].factsAsOf).toBe("2026-01-01");
    // Section bodies are stored at tree depth: #### in a bundle skill section is ### in a tree file.
    expect(tree.skills[0].sections).toEqual([{ heading: "Notes", body: "### Deep", line: 23 }]);
    expect(tree.packs[0].body).toBe("# Intro\n\nHello.\n\n---\n\n## Pack section\n\nAfter the break.");
  });

  it("reports a skill that a stray --- pushed into the pack", () => {
    const tree = parseBundle(
      "---\nid: p\n---\n\n# Branch: B\n\n- id: b\n\n## S1\n- id: b.s1\n- requires: —\n\n---\n\n## S2\n\n- id: b.s2\n- requires: —\n\n---\n\n## Review log\n\n- id: not a skill, just prose\n",
      "p.skilltree.md",
    );
    expect(tree.skills.map((s) => s.id)).toEqual(["b.s1"]);
    expect(tree.diagnostics).toEqual([
      expect.objectContaining({ code: "parse", line: 15, message: expect.stringMatching(/"S2" looks like a skill/) }),
    ]);
  });

  it("reports invalid frontmatter", () => {
    const tree = parseBundle("---\nid: [unclosed\n---\n# Branch: B\n- id: b\n", "bad.skilltree.md");
    expect(tree.diagnostics).toEqual([expect.objectContaining({ code: "parse", line: 1, message: expect.stringMatching(/Invalid YAML/) })]);
    expect(tree.packs[0].id).toBe("bad");
  });
});
