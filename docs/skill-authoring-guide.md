# skilltree — Skill Authoring Guide

This guide defines what a good skill, rank, item and quest looks like in skilltree. It is the standard that:

- the future authoring skill writes to,
- the validator checks, and
- review rounds critique against.

The storage format (how this is serialized) lives in the format spec; this guide defines the *content* rules. If the two disagree, fix the spec.

Credits: the structure borrows from Human Skill Tree's skill development guide and roadmap.sh's content conventions:
- required sections
- "active, not passive"
- specificity, scaffolding and failure modes
- validation split into hard requirements and quality warnings
- typed resource links with a cap per node
- one content unit per node

The rest comes from how the first seed was built and reviewed.

---

## 1. Taxonomy

- **Branch:** a parent topic (e.g. `finance`, `crypto`, `swe`). Branches are open-ended and there are no fixed "phases". A new branch needs at least three skills, or it's a skill in an existing branch.
- **Skill:** a node. Its id is `branch.skill-name`, kebab-case, and stable forever. Renaming a skill changes its title, never its id.
- **Rank:** a depth level within a skill. Most skills start with Rank 1; review rounds add Rank 2+ to deepen a skill instead of creating near-duplicate skills.
- **Item:** one concrete learning step inside a rank.
- **Quest:** an ordered, scheduled route through skills. Quests reference skills; they never contain items of their own, except maintenance habits.

## 2. Required content per skill

Adapted from Human Skill Tree's required sections, reshaped for a personal tree:

1. **Title:** plain name, e.g. "Cosmos Hub and the Cosmos SDK".
2. **id:** as above.
3. **requires:** blocking prerequisites only. Soft links go in `related`. Cross-branch is fine; cycles are not.
4. **Why:** one or two sentences on what this skill is for, in my world (e.g. which business line or goal it serves). Also required for skills with no items yet.
5. **estimate:** total hours across ranks.
6. **Ranks with items:** see §3.
7. **Recall:** 3–5 questions I should be able to answer without notes once the skill is learned. They serve three purposes:
   - **Placement test:** if I can answer them all before starting, I can mark the skill *learned (tested out)*. This is the personal version of Human Skill Tree's "diagnose the learner's level first".
   - **Spaced review:** they're the cards scheduled for review after the skill is learned (see §7).
   - **Rust check:** failing them later marks the skill rusty.
8. **Sources:** pages that back any factual claim in the skill, with an as-of date.

Starting skills (things I already know) need only title, id, requires, `status: learned (self-reported)` and optionally Why. Recall questions for them can be added later to turn "self-reported" into "tested out".

## 3. Required content per item

- **Type:** `watch`, `read`, `do`, `build`, `output` or `habit`.
- **Time estimate:** between ~10 min and ~2 h. Longer means split it. Shorter means merge it.
- **Resources:** typed links, roadmap.sh-style: `[@type@Title](url)`, at most 5 per item.
- **Instructions:** `Do:` and optionally `Skip:`. Be specific: "watch sessions 1, 2, 11 at 1.25x", not "watch the course". This is Human Skill Tree's "instruction specificity" rule.
- **Done when** (required on at least one item per rank): an observable self-check. It must be something I can *demonstrate* (explain, compute, draw, build, predict), not "I understand X".
- **If stuck** (optional; required on `build` items): what to do instead of giving up. For example, a simpler resource, a smaller version of the task, or the question to ask Claude. This is Human Skill Tree's "failure modes" rule, adapted: a hint, not the answer.
- **Fast track** (optional): what to skip if I already know part of it. This is Human Skill Tree's "scaffolding" rule.

### Resource types

| Tag | Use for |
| --- | --- |
| `@video@` | A specific video or playlist |
| `@search@` | A YouTube (or other) search link, to be resolved into an exact video later. The validator reports these. |
| `@course@` | A structured course (e.g. MIT OCW, a lecture series page) |
| `@official@` | Official docs, specs, governance proposals, company pages |
| `@article@` | Articles, research posts, analyses, lecture-note PDFs |
| `@book@` | Books, including free online books |
| `@podcast@` | Podcast shows or episodes |
| `@tool@` | Dashboards and tools I use hands-on (DefiLlama, Dune, CoinGlass…) |
| `@opensource@` | Repos |
| `@feed@` | Newsletters, blogs, and feeds to follow |

## 4. Pedagogy rules

- **Active, not passive** (from Human Skill Tree): every rank must make me produce something. That means a `do`, `build` or `output` item, or a Done when that requires me to explain, compute or predict. Ranks without a `do` / `build` / `output` item are flagged in review so a hands-on item can be considered.
- **YouTube first, but not YouTube only:** start with video where good video exists, then add primary sources (official docs, papers, the company's own methodology).
- **Engineer-friendly depth:** prefer hands-on builds (pull the data, recompute the number) and failure case studies over summaries.
- **Loot:** a skill that teaches judgement (risk, markets, strategy) ends with an `output` item, a short written deliverable.
- **Work relevance:** when a skill connects to my job, name the connection in Why, and make at least one item use my real tools (e.g. the Terminal, SR's own pages).

## 5. Time-sensitive content

- Any item that states a current fact (upgrade status, a rate, a law, a product feature) is marked `[time-sensitive]`. It needs a `Verify:` line saying exactly what to re-check.
- Every seed or authoring session stamps an as-of date (`facts_as_of`).
- **Freshness window:** 90 days by default. After that, the item's skill shows as rusty until I re-verify. Re-verifying updates the as-of date, or edits the fact and logs the change.
- Facts come from pages actually opened during authoring. Never from memory, and never from search snippets alone.

## 6. Sizing and structure

- **Ranks:** 1–5 h each. Anything bigger becomes two ranks or two skills.
- **Skill vs rank vs item:** deeper → new rank; different subject → new skill; smaller step → item.
- **Reuse before creating:** before adding a skill, search the tree for an existing node. Add a rank or a `related` link instead of a near-duplicate.
- **Prerequisites stay minimal:** only what's genuinely needed to start. Over-linking makes everything locked.

## 7. Progress, review and rust

These are defaults; the app may tune them.

- **Item states:** todo → done, or skipped. Skipped items don't block learning a rank, but they're shown. This follows roadmap.sh's done / in progress / skip model.
- **Skill states:**
  - locked: prerequisites not learned
  - available
  - in progress
  - learned: every rank's Done when is checked and recall is answered
  - learned (tested out)
  - learned (self-reported)
  - rusty: a time-sensitive item is past its freshness window, or a recall review failed
- **Spaced review** of Recall questions uses Leitner-style intervals (e.g. 1, 3, 7, 14, 30 days, as in Human Skill Tree's tracker, extended). A failed review drops the question back a box and can mark the skill rusty.
- **XP:** hours logged, weighted by item type. Active work (`do`, `build`, `output`) earns more than passive work (`watch`, `read`); passing a review earns a small bonus. XP is never earned for merely opening things.

## 8. Quests

- A quest lists skills in order, with week ranges and an hours-per-week target. It must never schedule a skill before its prerequisites.
- Recurring habits live in a quest's **maintenance** section, not inside skills (except monthly/annual habits tied to one skill).
- A quest has a goal sentence, a pace, and a follow-on stage for skills that aren't week-bound.

## 9. Review rounds

Every new or changed skill or quest goes through at least one review round:

1. **Critique** against this guide:
   - specificity
   - Done when quality
   - active items
   - time-sensitive facts
   - sizing
   - prerequisite sanity
   - work relevance
2. **Fix**, then log the changes in the file's review log (round number, date, what changed and why).
3. **Ask** at most three open questions for the next round.

## 10. Validation

The validator runs on every change (pre-commit or CI).

**Hard requirements** (fail):
- Every id is unique, and every `requires` / `related` id resolves.
- The prerequisite graph has no cycles.
- Every skill (except starting skills) has Why, estimate, ≥1 rank, and a Recall section with ≥3 questions.
- Every item has a type and a time estimate; every rank has ≥1 Done when; every `build` item has an If stuck.
- Every `[time-sensitive]` item has a Verify line, and the file has `facts_as_of`.
- Every quest respects prerequisites.

**Quality warnings** (report, don't fail):
- A rank with no `do` / `build` / `output` item.
- More than 5 resources on one item.
- Item estimates in a skill summing outside ±25% of the skill estimate.
- Any `@search@` links, with a count, since each should become an exact video.
- A Why or Done when under ~40 characters.
- A skill with no Sources while it contains time-sensitive items.
- Time-sensitive items already past the freshness window.

## 11. Minimal example

```markdown
## Cosmos Hub and the Cosmos SDK
- id: crypto.cosmos-staking
- requires: crypto.consensus, crypto.staking-metrics
- estimate: ~3 h

Why: SR's Cosmos formula covers every Cosmos SDK chain it tracks, so learning one chain properly unlocks dozens.

### Rank 1
- [ ] [build] Pull Cosmos Hub parameters from chain — ~1 h
  - Resource: [@opensource@chain registry](https://github.com/cosmos/chain-registry)
  - Do: fetch mint, staking-pool, distribution and slashing params; plug them into the SRB formula.
  - Done when: my hand-computed ATOM reward rate lands close to SR's.
  - If stuck: start from SR's Cosmos Hub SRB doc and compute with SR's own inputs first.

### Recall
- Why is ATOM's staking yield roughly inflation divided by the staking ratio?
- What is Interchain Security, and who gets paid?
- How long is Cosmos Hub unbonding, and what does that mean for liquidity?
```
