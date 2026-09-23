import { describe, expect, it } from "vitest";
import { assignMissingIds, itemIdFromTitle, slugify } from "@/lib/content/ids";
import { parseBundle } from "@/lib/content/parse-bundle";
import type { ContentTree } from "@/lib/content/types";

describe("slugify", () => {
  it("kebab-cases and strips markdown", () => {
    expect(slugify("Crypto & Finance for The Tie")).toBe("crypto-finance-for-the-tie");
    expect(slugify("Skim the [@feed@SR Journal](https://x.io/weekly) — `now`")).toBe("skim-the-sr-journal-now");
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
    expect(slugify("  ---  ")).toBe("");
  });

  it("truncates at a word boundary", () => {
    expect(slugify("alpha beta gamma delta", 12)).toBe("alpha-beta");
    expect(slugify("supercalifragilistic", 8)).toBe("supercal");
  });
});

describe("itemIdFromTitle", () => {
  it("uses the first six words, at most 40 characters", () => {
    expect(itemIdFromTitle("Figment — Glamsterdam: what it means for institutional stakers")).toBe(
      "figment-glamsterdam-what-it-means-for",
    );
    expect(itemIdFromTitle("Technical depth, one episode a month: [@podcast@Epicenter](https://epicenter.tv)")).toBe(
      "technical-depth-one-episode-a-month",
    );
    expect(itemIdFromTitle("Interoperability considerations for decentralization maximalists everywhere").length).toBeLessThanOrEqual(40);
    expect(itemIdFromTitle("!!!")).toBe("item");
  });
});

const BUNDLE = `---
id: t
facts_as_of: 2026-01-01
---

# Branch: Test

- id: t

## Skill
- id: t.skill
- requires: —
- estimate: ~1 h

### Rank 1
- [ ] [read] Same title — ~10 min
- [ ] [read] Same title — ~10 min {#same-title-2}
- [ ] [read] Same title — ~10 min
- [ ] [do] Kept — ~10 min {#kept}

### Recall
- One? {#q2}
- Two?
- Three? {#q5}
- Four?

# Quest: Q

- id: quest-q

## Maintenance (weekly)

- [ ] [habit] Same habit — ~10 min
- [ ] [habit] Same habit — ~10 min
`;

describe("assignMissingIds", () => {
  const tree = parseBundle(BUNDLE, "t.skilltree.md");
  const filled = assignMissingIds(tree);
  const items = filled.skills[0].ranks[0].items;

  it("makes item ids unique per owner and leaves existing ids alone", () => {
    expect(items.map((i) => i.id)).toEqual(["same-title", "same-title-2", "same-title-3", "kept"]);
    expect(items.map((i) => i.key)).toEqual(["t.skill/same-title", "t.skill/same-title-2", "t.skill/same-title-3", "t.skill/kept"]);
  });

  it("numbers new recall questions after the highest existing one", () => {
    expect(filled.skills[0].recall.map((q) => q.id)).toEqual(["q2", "q6", "q5", "q7"]);
  });

  it("fills quest maintenance items with the quest as owner", () => {
    expect(filled.quests[0].maintenance?.items.map((i) => i.key)).toEqual(["quest-q/same-habit", "quest-q/same-habit-2"]);
  });

  it("does not mutate its input and is idempotent", () => {
    expect(tree.skills[0].ranks[0].items[0].id).toBe("");
    const again: ContentTree = assignMissingIds(filled);
    expect(again).toEqual(filled);
  });
});
