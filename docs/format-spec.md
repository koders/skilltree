# skilltree — Content Format Spec

This spec defines how skilltree content is **stored**: the files, their syntax and how they parse. The *content rules* (what a good skill looks like) live in [`skill-authoring-guide.md`](./skill-authoring-guide.md). The guide wins: if this spec can't express something the guide asks for, change this spec.

- Spec version: **1**
- Parser: `src/lib/content/` · Validator: `pnpm validate` · Importer: `pnpm content:import`

---

## 1. Two shapes, one syntax

Content exists in two shapes that share the same block syntax:

| Shape | Where | Used for |
| --- | --- | --- |
| **Tree** (one file per unit) | `content/` | The live tree the app reads. One file per skill, per branch and per quest. Easy to diff and edit. |
| **Bundle** (`*.skilltree.md`) | anywhere | Authoring and review: a whole pack of branches, skills and a quest in one file, like the seed. Validated as-is, then imported into the tree. |

A skill block is written the same way in both shapes. The only difference is heading depth: a skill is `#` in its own file and `##` inside a bundle branch. Everything under it shifts by one level with it.

```
content/
  branches/
    <branch-id>/
      _branch.md              # the branch itself
      <skill-slug>.md         # one file per skill; id = <branch-id>.<skill-slug>
  quests/
    <quest-slug>.md           # id = quest-<quest-slug>
  packs/
    <pack-id>.md              # history of one authoring session (review log, open questions, sources)
```

The file path must agree with the ids inside: `content/branches/crypto/cosmos-staking.md` must contain `- id: crypto.cosmos-staking`. The validator checks this.

---

## 2. Skill block

```markdown
# Cosmos Hub and the Cosmos SDK
- id: crypto.cosmos-staking
- requires: crypto.consensus, crypto.staking-metrics
- related: finance.market-structure
- estimate: ~3 h
- facts_as_of: 2026-09-23

Why: SR's Cosmos Hub formula covers every Cosmos SDK chain it tracks, so learning one chain properly unlocks dozens.

## Rank 1
- [ ] [read] Cosmos Hub staking mechanics — ~30 min {#staking-mechanics}
  - Note: CometBFT gives instant finality; up to 180 active validators; 21-day unbonding.
- [ ] [build] Pull Cosmos Hub parameters from chain — ~1 h {#pull-hub-params}
  - Resource: [@opensource@chain registry](https://github.com/cosmos/chain-registry)
  - Do: fetch mint, staking-pool, distribution and slashing params; plug them into the SRB formula.
  - Done when: my hand-computed ATOM reward rate lands close to SR's.
  - If stuck: start from SR's Cosmos Hub SRB doc and compute with SR's own inputs first.

## Recall
- Why is ATOM's staking yield roughly inflation divided by the staking ratio? {#q1}
- What is Interchain Security, and who gets paid? {#q2}
- How long is Cosmos Hub unbonding, and what does that mean for liquidity? {#q3}

## Sources
- [SR docs: Cosmos Hub SRB](https://docs.stakingrewards.com/...) — as of 2026-09-23

## Review log
- **Round 5 (2026-09-23)**: …
```

### 2.1 Title and metadata

The heading is the skill's **title**. It is followed immediately by metadata bullets, `- key: value`, one per line:

| Key | Required | Value |
| --- | --- | --- |
| `id` | yes | `branch.skill-name`, kebab-case, stable forever. Renaming a skill changes the title, never the id. |
| `requires` | yes | Comma-separated skill ids that **block** this skill. `—` (or `-`, or empty) for none. May cross branches. |
| `related` | no | Comma-separated soft links. Never block anything. |
| `status` | starting skills only | `learned (self-reported)`: a skill I already have. Marks it learned from day one. |
| `estimate` | yes, except starting skills | Total hours across ranks, e.g. `~3 h`. See §6.2 for optional hours. |
| `facts_as_of` | when the skill has `[time-sensitive]` items (tree shape) | `YYYY-MM-DD`: the date the skill's facts were last checked. In a bundle, skills inherit the bundle's `facts_as_of`. |
| `color` | no (branches only) | Hex colour for the branch in the tree view. |
| `order` | no (branches only) | Sort order of branches around the tree. |

Unknown keys are kept and shown, and the validator warns about them.

### 2.2 Why and description

The first paragraph starting with `Why:` is the skill's **Why**. Any other paragraphs before the first rank are kept as a free-form **description**.

### 2.3 Sections

Each `##` heading under a skill (one level below the skill title) opens a section:

| Heading | Meaning |
| --- | --- |
| `Rank N` or `Rank N — Name` | A rank. `N` is 1, 2, 3… and ranks appear in order. The rank's id is `rank-N`. |
| `Recall` | Recall questions (§2.6). |
| `Sources` | Sources backing the skill's facts (§2.7). |
| `Review log` | Free markdown: this skill's review history. |
| anything else | Kept verbatim as an extra section and shown in the side panel. |

A rank may open with its own metadata bullet `- requires: …`. Those prerequisites gate **that rank only** (for example, Terminal Rank 2 needs market structure).

### 2.4 Items

An item is a bullet inside a rank (or a quest's maintenance section):

```
- [ ] [type] [flag]… Title — ~time {#item-id}
  - Label: text
```

- **Checkbox** `[ ]` is conventional and optional. `[x]` is accepted and ignored: progress lives in the database, not in content.
- **Type**, required: one of `watch`, `read`, `do`, `build`, `output`, `habit`.
- **Flags**, optional, any order after the type:
  - `[time-sensitive]`: the item states a current fact (§4).
  - `[optional]`: doesn't block completing its rank, and its time doesn't count toward the skill estimate. A title starting with the word **Optional** (e.g. `Optional book, pick one: …`) sets this flag implicitly.
- **Title**: inline markdown. It may contain ` — ` itself: the time is always the text after the **last** ` — ` that is followed by `~` or a digit.
- **Time**, required: `~` plus a duration (see §6.1), optionally followed by a note that is kept for display: `~1 h total`, `~45 min at 1.5x`.
- **Id** `{#item-id}`, required in the tree shape: kebab-case, unique within the skill (or quest), stable forever. Progress is stored against `<skill-id>/<item-id>`, so **never change an existing item id**. You can rewrite the title freely. In a bundle, ids may be omitted; the importer generates them. `pnpm content:ids` adds any that are missing in the tree.

**Sub-bullets** are `Label: text`, indented under the item. The known labels:

| Label | Meaning |
| --- | --- |
| `Resource:` | Typed links (§3), optionally with prose around them. |
| `Do:` | Specific instructions. |
| `Skip:` | What to leave out. |
| `Done when:` | Observable self-check. At least one per rank. |
| `If stuck:` | What to do instead of giving up. Required on `build` items. |
| `Fast track:` | What to skip if I already know part of it. |
| `Note:` | Context. |
| `Verify:` | For `[time-sensitive]` items: exactly what to re-check. |
| `As of:` | `YYYY-MM-DD`. Overrides the skill's `facts_as_of` for this item only. |
| `Cadence:` | For `habit` items (§5). |

Any other `Label:` (e.g. `Case study:`) is kept in order and shown with its label. A sub-bullet without a label is shown as a plain note. A line indented deeper than the sub-bullet continues it.

### 2.5 Resources inside text

A typed link can appear in **any** item text: the title, `Resource:`, `Do:`, `Note:` and so on. All typed links in an item count as its resources (and toward the cap of 5).

### 2.6 Recall

```
## Recall
- Question text? {#q1}
```

3–5 questions. Each has a stable id (`q1`, `q2`, …), required in the tree shape and generated by the importer. Test-out, completion checks and (later) spaced review store results against `<skill-id>` + question id, so ids stay stable when questions are reordered or reworded. A new question gets the next unused number, never a reused one.

### 2.7 Sources

```
## Sources
- [Title](url) — as of 2026-09-23
- [Title](url) — anything after the dash is a note
```

### 2.8 Starting skills

A starting skill needs only title, `id`, `requires` and `status: learned (self-reported)`. A Why, ranks and Recall are optional. Adding Recall questions later lets me test out and turn *self-reported* into *tested out*.

---

## 3. Typed resource links

roadmap.sh-style: `[@type@Title](url)`.

| Type | Use for |
| --- | --- |
| `@video@` | A specific video or playlist |
| `@search@` | A search link to resolve into an exact video later; the validator counts these |
| `@course@` | A structured course |
| `@official@` | Official docs, specs, governance proposals, company pages |
| `@article@` | Articles, research, analyses, lecture-note PDFs |
| `@book@` | Books, including free online books |
| `@podcast@` | Podcast shows or episodes |
| `@tool@` | Dashboards and tools used hands-on |
| `@opensource@` | Repos |
| `@feed@` | Newsletters, blogs and feeds to follow |

A plain markdown link `[Title](url)` is just a link: it's shown, but it isn't a typed resource.

---

## 4. Time-sensitive content

- Mark the item `[time-sensitive]` and give it a `Verify:` line.
- The item's **as-of date** is its `As of:` line if it has one, otherwise the skill's `facts_as_of`, otherwise the bundle's `facts_as_of`.
- The app also stores re-verifications (a button on the item). The **effective** as-of date is the later of the content date and the last re-verification.
- **Freshness window:** 90 days. Past it, the item is *stale*: its skill shows as rusty if learned, and carries a stale-facts flag if not.
- A fact that changed is fixed in the content file, with the new `As of:` (or `facts_as_of`) and a review-log line.

---

## 5. Habits

`habit` items are recurring. Where they may live, per guide §8:

- **Quest maintenance**: the normal home for recurring habits (§7.3).
- **Inside a skill**: only monthly or annual habits tied to that one skill. They never block completing a rank, and they don't count toward the skill estimate. They go active on the Maintenance page once the skill is in progress or learned.

Cadence comes from the first of these that is set:

1. A `Cadence:` sub-bullet: `weekly`, `monthly`, `yearly` (or `annually`), `2× week`, `twice a week`, `3x month`…
2. Wording in the title, e.g. "one episode a month", "Annual …", "10 min twice a week".
3. The maintenance section's cadence (e.g. `weekly`).

For a habit, the time is **per occurrence**.

---

## 6. Durations

### 6.1 Item time

`~` then a number and a unit: `h`, `hr`, `hour(s)`, `min`, `mins`, `minute(s)`. Two parts are allowed: `~1 h 30 min`. A range, `~1–2 h`, counts at its upper bound. Anything after the duration (`total`, `at 1.5x`) is a display note.

### 6.2 Skill estimate

`~3.5 h` is the core hours. Any duration in a part of the text that mentions `optional` counts as optional hours: `~3.5 h + optional book (~6 h)` and `~2 h (+1 h optional)` both work. Other trailing text (`+ monthly habits`) is kept for display.

The validator compares the core hours with the sum of the skill's **required** item times, excluding optional items and habits.

---

## 7. Branches, quests, packs

### 7.1 Branch file: `content/branches/<id>/_branch.md`

```markdown
# Software Engineering
- id: swe
- note: seeded with skills I already have (self-reported).
- color: #38bdf8
- order: 1

Optional free-form description.
```

In a bundle the heading is `# Branch: Software Engineering`, and the branch's skills follow as `##` blocks.

### 7.2 Quest file: `content/quests/<slug>.md`

```markdown
# Crypto & Finance for The Tie
- id: quest-crypto-finance-the-tie
- pace: 12 weeks, ~4–5 h/week, then follow-on and maintenance
- goal: go from "engineer who stakes and lends" to someone who understands …

| Weeks | Stage | Skills (in order) |
| --- | --- | --- |
| 1–3 | Foundations | crypto.consensus → finance.money-settlement → crypto.eth-validators |
| 4–7 | Staking | crypto.staking-metrics → … → finance.market-intelligence (Rank 1) → … |
| 13+ | Follow-on | finance.regulation → crypto.infrastructure |

## Maintenance (weekly, from week 13, ~2 h/week)

Keeps learned skills from going rusty.

- [ ] [habit] Unchained's weekly news episode — ~45 min at 1.5x {#unchained-weekly}
```

- `pace` is prose. The parser reads **weeks** (`12 weeks`) and **hours per week** (`~4–5 h/week`, or a single number) from it.
- The **stage table** needs `Weeks`, `Stage` and `Skills` columns:
  - Weeks are `N`, `N–M` or `N+` (open-ended follow-on).
  - Skills are ids separated by `→` (or `->`, or `,`).
  - A skill can be limited to some ranks: `(Rank 1)`, `(Ranks 1–2)`. The same skill can appear in several stages with different ranks.
- The **maintenance heading** carries its cadence, start week and weekly hours: `Maintenance (weekly, from week 13, ~2 h/week)`.
- Other `##` sections (e.g. `Review log`) are kept.

### 7.3 Pack file: `content/packs/<id>.md`

A pack is the history of one authoring session. It holds the bundle's YAML frontmatter (`id`, `title`, `owner`, `created`, `facts_as_of`, `review_rounds`, `branches`, `quests`) and its non-skill markdown: context, conventions, review log, open questions and sources. The app shows packs in the History view, and the validator doesn't check their prose.

---

## 8. Bundle shape (`*.skilltree.md`)

The seed shows the format:

1. YAML frontmatter with the pack fields (§7.3). `facts_as_of` is required.
2. An intro: a `#` heading that isn't `Branch:` or `Quest:`, plus anything before the first branch. It belongs to the pack.
3. `# Branch: Title` sections, each with branch metadata bullets and `##` skill blocks.
4. `# Quest: Title` sections.
5. A thematic break (`---`) closes the current branch or quest. `##` sections that come after a break and before the next `#` belong to the pack (e.g. the review log and sources at the end of the seed).

`pnpm content:import <file>` does four things:

- splits a bundle into the tree shape
- generates missing item and recall ids
- stamps `facts_as_of` on skills with time-sensitive items
- copies each pack source into the skills whose text links to the same URL

It refuses to overwrite existing skills unless you pass `--force`. `pnpm content:bundle` goes the other way and writes the whole tree as one bundle, e.g. for a review round.

---

## 9. Validation

`pnpm validate` runs on `content/`, or on a bundle given as an argument. Errors fail the run (exit 1). Warnings are reported. `--json` prints machine-readable diagnostics for tools such as the future authoring skill.

**Errors**, which are the guide's hard requirements plus what this storage format needs:

| Code | Rule |
| --- | --- |
| `parse` | Unparseable structure: an item without a type, an unknown item type, an unparseable time or date, a malformed stage table |
| `duplicate-id` | Skill, branch, quest, item (within its owner) or recall id is not unique |
| `unresolved-ref` | A `requires`, `related`, rank `requires` or quest step names an unknown skill |
| `cycle` | The prerequisite graph (skill and rank requires) has a cycle |
| `missing-why` / `missing-estimate` / `missing-rank` | A non-starting skill without Why, estimate or at least one rank |
| `recall-too-few` | A non-starting skill with fewer than 3 Recall questions |
| `item-missing-time` | An item without a time estimate |
| `rank-missing-done-when` | A rank with no `Done when:` on any item |
| `build-missing-if-stuck` | A `build` item without `If stuck:` |
| `time-sensitive-missing-verify` | A `[time-sensitive]` item without `Verify:` |
| `missing-facts-as-of` | Time-sensitive content with no as-of date to inherit |
| `quest-order` | A quest step scheduled before one of its prerequisites (a skill or rank-level `requires` that isn't a starting skill and doesn't appear earlier in the quest) |
| `missing-item-id` / `missing-recall-id` | Tree shape only: an item or recall question without `{#id}` |
| `path-mismatch` | A tree file's path disagrees with its id |

**Warnings**, the guide's quality checks plus sizing hints from guide §3 and §6:

| Code | Rule |
| --- | --- |
| `rank-not-active` | A rank with no `do` / `build` / `output` item |
| `too-many-resources` | More than 5 typed links on one item |
| `estimate-mismatch` | Required item times summing outside ±25% of the skill estimate |
| `search-links` | `@search@` links still to resolve (with a count) |
| `short-why` / `short-done-when` | Under 40 characters |
| `passive-done-when` | A Done when that reads "I understand …" instead of something demonstrable |
| `no-sources` | A skill with time-sensitive items and no Sources |
| `stale` | A time-sensitive item past the 90-day freshness window |
| `item-size` | An item under 10 min or over 2 h (optional items and habits excepted) |
| `rank-size` | A rank's required time outside 1–5 h |
| `recall-too-many` | More than 5 Recall questions |
| `branch-too-small` | A branch with fewer than 3 skills |
| `weekly-habit-in-skill` | A habit more frequent than monthly inside a skill |
| `habit-no-cadence` | A habit whose cadence can't be determined |
| `unknown-resource-type` / `unknown-key` | Something the spec doesn't define |
