# Starter prompt — skilltree

> Paste this into Claude Code from the root of the `skilltree` repo. Put these files in the repo first:
> - `crypto-finance-the-tie.skilltree.md`: the seed content
> - `docs/skill-authoring-guide.md`: the content standard

## The idea

`skilltree` is my personal, real-life skill tree, modelled on the skill trees in games I love.

- **Branches** are parent topics: Software Engineering, Finance & Markets, Crypto & Web3, and more over time.
- **Skills** sit inside each branch as nodes, connected by prerequisites. Prerequisites can cross branches.
- **Items** inside each skill are the concrete learning steps: videos, reading, hands-on work, builds and written outputs.

Learning a skill means working through its items, passing its "Done when" checks, and answering its Recall questions. Over time the tree should show three things: what I know, what's unlocked next, and what's going rusty.

The app has three jobs:

1. **Follow:** quests (curated, scheduled routes through the tree) tell me what to do this week.
2. **Track:** node states, time spent, my notes and outputs, and review results.
3. **Grow:** add new branches, skills and quests over time. Later, a Claude Code skill will author them following the authoring guide.

It's for me only: one user, low maintenance, a tool I actually open every week.

## Game concepts → real life

These are ideas to build on, not a spec.

| Game concept | In skilltree |
| --- | --- |
| Skill tree / branch | Parent topic, e.g. Finance & Markets |
| Skill node | A skill, e.g. "Cosmos Hub and the Cosmos SDK" |
| Prerequisite edge | Blocking prerequisites; can cross branches |
| Skill rank (1/3, 2/3…) | Depth levels within a skill |
| Unlock condition | "Done when" checks + Recall questions |
| Test out | Answer a skill's Recall questions before starting → learned (tested out) |
| Loot | Written outputs and builds |
| XP | Hours logged, weighted toward active work |
| Quest line | A curated, scheduled route through nodes |
| Dailies / weeklies | Maintenance habits |
| Skill decay / rust | Time-sensitive facts past their freshness window, or failed recall reviews |
| Starting skills | Things I already know, seeded as learned (self-reported) |

## Who I am

I'm the Frontend Tech Lead on the Staking Rewards platform at The Tie, working as a contractor. I'm an engineer first, and I'm building real domain knowledge in crypto and finance. My main learning format is YouTube, mixed with reading and hands-on builds. I build with Claude Code and direct rather than hand-write code. My usual stack is React, Next.js, GraphQL and viem. Treat that as context, not a requirement.

## How we got here

This came out of a chat with Claude:

1. A crypto YouTube video made me want to go deeper, so I asked for a learning path tied to The Tie's business lines (Terminal, Staking Rewards, Stakin staking infrastructure, The Tie Capital).
2. It went through review rounds in a doc:
   - every item got an exact scope, a time estimate and a "Done when" check, plus written outputs
   - current facts were verified and dated
   - Terminal access and a third deep chain (Cosmos) were added
3. A doc was the wrong container. I wanted tracking, notes and a repeatable way to add learning, so I decided to build an app.
4. I named it skilltree, and the plan was reshaped into branches, skills and a quest.
5. I researched prior art. roadmap.sh and Human Skill Tree are both great, but neither does what I want: a tree of *my* skills with hand-curated, work-relevant content, quests and rust. So we borrowed their best ideas:
   - an authoring guide modelled on Human Skill Tree's skill development guide
   - typed resources from roadmap.sh
   - Recall questions for test-out and spaced review
   - a validator with hard rules and quality warnings

## What's in the repo to start

- **`crypto-finance-the-tie.skilltree.md`**, the seed:
  - **Branches:** three branches with 24 skills. Software Engineering has 5 starting skills; Finance & Markets has 6; Crypto & Web3 has 13.
  - **Skills:** each has a Why line, prerequisites (some cross-branch), ranks, items, and a Recall section.
  - **Items:** each has a type and a time estimate, typed resource links, do/skip instructions, and a Done when check. Build items also have an If stuck line.
  - **Time-sensitive items:** marked, with a Verify line, all as of 2026-09-23.
  - **Quest:** one quest, "Crypto & Finance for The Tie", running 12 weeks plus a follow-on stage and weekly maintenance.
  - **History:** a review log (four rounds), open questions, and sources. 14 `@search@` links still need resolving into exact videos.
  - **Validation:** it already passes the guide's hard rules.
- **`docs/skill-authoring-guide.md`**, the content standard, covering:
  - taxonomy and required content per skill and per item
  - resource types
  - pedagogy rules and time-sensitivity rules
  - progress states, spaced review and XP defaults
  - quest rules and the review-round process
  - validation (hard requirements vs quality warnings)

  Your storage format must be able to express everything in it. Where your format spec and the guide disagree, update the spec.

## Prior art: ideas to borrow

**From roadmap.sh:**
- **One content unit per node.** Each topic's content is its own markdown file linked to a node id, separate from the diagram, which makes content easy to diff and edit. Consider one file per skill rather than one giant file (the seed is one file only for convenience).
- **Typed resource links with a cap per node.** Already adopted in the guide.
- **A clickable node opens a side panel** with the description, resources and a progress control (done, in progress, skip).
- **Forkable roadmaps.** My version: fork a quest to try a different schedule without touching the original.
- **AI courses generated from a roadmap.** Keep in mind for later: any AI generation must be anchored to the node's context (branch, Why, prerequisites). Without that, "Go" gets taught as the board game instead of the language.
- **From a roadmap.sh-style derivative (eee-roadmap):** a focus view that expands only incomplete or starred topics, starring important topics, and personal note windows per concept.

**From Human Skill Tree:**
- **Skill development guide + validator.** Required sections; "active, not passive"; instruction specificity, scaffolding and failure modes; a validation script split into hard requirements and quality thresholds, run in CI. Adopted as our guide; please build the validator.
- **Interactive DAG canvas + a searchable list view.** Their tree is a React Flow canvas with a list view beside it. Their layout is hand-configured per phase; ours should be derived automatically from prerequisites and branches.
- **Diagnose the level before teaching.** Our version is the Recall-based test-out.
- **Knowledge points with mastery and Leitner-style review intervals.** Our version is spaced review of Recall questions.
- **XP and levels.** Their XP table weights harder actions more, with a level curve. Our version weights active work; consider weekly rather than daily streaks, since I work in 4–5 h/week blocks.
- **Local-first storage with JSON export/import and optional sync.** A good default for a personal tool.
- **The AI hidden-tag protocol.** Their tutor chat emits structured tags that update progress. Our later version: a Claude Code review skill that quizzes me on Recall questions (hints, not answers) and writes results back in a structured format.

**What not to copy:** tutor personas, social features, slide/PPTX generation, i18n, multi-user auth, and any broad pre-built curriculum.

**Licenses:** Human Skill Tree's app is AGPL-3.0, so take ideas only, not code. Check roadmap.sh's repository license before reusing anything from it.

## What I need in v1

- **Import and validate:**
  - Import the seed, and define a documented, human-editable format spec that can express everything in the authoring guide.
  - Build the validator: hard rules fail, quality issues warn, runnable locally and wired into a pre-commit hook or CI.
- **The skill tree view, which is the heart of the app:**
  - branches and skills drawn as a graph with an automatic layout from prerequisites, including cross-branch edges
  - it should feel like a game skill tree, not an org chart
  - node states: locked, available, in progress, learned, tested out, self-reported, rusty
  - a list view and a focus view alongside the canvas
  - clicking a node opens a side panel with Why, ranks, items, typed resources and Recall
- **Quest view:** what's next this week on the active quest.
- **Progress:**
  - mark items done or skipped
  - log time (XP)
  - attach notes and outputs to items and skills
  - a test-out flow on any available skill
  - progress per skill, branch and quest
- **Maintenance:** recurring habits.
- **Rust:** time-sensitive items past the freshness window flag their skill.
- **Export/import** of all my data.

**Later, don't build now, but design the data model so these fit without pain:**
- spaced review of Recall questions (Leitner-style)
- the Claude Code review skill described above
- the course-authoring skill, which follows the guide and runs the validator
- resolving `@search@` links into exact videos
- forking quests

## Decisions I'm leaving to you

Architecture, stack, storage, hosting, data model, graph rendering, UI and game-mechanic tuning are all yours. Pick what fits a single-user, low-maintenance personal tool. Write the decisions down briefly in the repo (why, and what you rejected), then build v1 in small, working increments. Only ask me if you're genuinely blocked.

## First session

Read the seed and the authoring guide. Then:

1. Decide the architecture.
2. Write the format spec and your decisions.
3. Build the validator and run it on the seed.
4. Build v1 until I can see my tree, test out of a skill, start the quest, and work through week 1.
