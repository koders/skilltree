# skilltree

My real-life skill tree, modelled on the skill trees in games:

- **Branches:** the big topics.
- **Skills:** nodes in a branch, linked by prerequisites.
- **Ranks and items:** the concrete learning steps inside each skill.
- **Quests:** scheduled routes through the tree.

The tree shows what I know, what's unlocked next, and what's going rusty.

- **Follow:** the active quest tells me what to do this week.
- **Track:** item states, time (XP), notes and outputs, test-outs, quest progress, habits.
- **Grow:** new skills and quests are markdown files, checked by a validator.

Single user, low maintenance. Next.js 16 + Supabase.

## Run it locally

Prerequisites: Node 22+, pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # then fill in the three Supabase values
pnpm db:migrate              # creates the tables (safe to re-run)
pnpm dev                     # http://localhost:3000
```

`.env.local` needs:

| Var | Where to find it |
| --- | --- |
| `SUPABASE_PROJECT_URL` | Dashboard → Project Settings → API |
| `SUPABASE_SECRET_KEY` | Dashboard → Project Settings → API keys → secret key (`sb_secret_…`). Server-side only. |
| `SUPABASE_DB_URL` | Dashboard → Connect → **Session pooler** URI. The direct `db.<ref>.supabase.co` host is IPv6-only. Only migrations use this. |

There's no login. The app runs locally (see [docs/decisions.md](docs/decisions.md) D2 for how to add a gate before deploying).

## How it's organised

```
content/                     the tree itself — markdown, one file per unit
  branches/<branch>/_branch.md
  branches/<branch>/<skill>.md
  quests/<quest>.md
  packs/<pack>.md            history of each authoring session (review log, sources)
docs/
  skill-authoring-guide.md   content standard (what a good skill looks like)
  format-spec.md             storage format (how content is written down)
  decisions.md               architecture decisions and what was rejected
supabase/migrations/         progress schema (SQL)
src/lib/content/             parser, serializer, validator
src/lib/engine/              pure derived state: node states, rust, XP, quest week plan, habits
src/lib/layout/              radial constellation layout of the tree
src/lib/db/                  Supabase access (server-only) + mutations
src/app/                     pages and server actions
```

**Content** lives in git and **progress** lives in Supabase. They're joined only by stable ids: a skill's `id`, an item's `{#id}` and a recall question's `{#qN}`. Everything else (locked, available, in progress, learned, rusty, XP, this week's plan) is computed on every request, so changing a rule never needs a migration.

## Commands

```bash
pnpm dev                        # dev server
pnpm validate                   # validate content/ (errors fail, warnings report)
pnpm validate some.skilltree.md # validate a bundle before importing it
pnpm validate --json            # machine-readable, for tools
pnpm content:import <bundle>    # split a *.skilltree.md bundle into content/
pnpm content:ids                # add missing {#ids} after hand-editing
pnpm content:bundle             # write the whole tree as one bundle (e.g. for a review round)
pnpm progress:export [file]     # back up all progress as JSON (also in the app: Data)
pnpm progress:import <file>     # merge a progress JSON (add --replace to overwrite)
pnpm db:migrate [--status]      # apply SQL migrations
pnpm check                      # validate + typecheck + lint + test (what CI runs, minus build)
```

A pre-commit hook runs the validator and the tests. GitHub Actions runs the full `check` plus `next build`.

## Adding content

1. Write a bundle (`*.skilltree.md`, the same shape as the original seed) or edit files in `content/` directly, following [the authoring guide](docs/skill-authoring-guide.md) and [the format spec](docs/format-spec.md).
2. `pnpm validate path/to/bundle.skilltree.md`, then fix any errors.
3. `pnpm content:import path/to/bundle.skilltree.md`.
4. Commit. The app picks up the new files on the next request.

Never change an existing skill id, item `{#id}` or recall `{#qN}`: progress is stored against them. Titles and text can change freely.

## Game rules

The defaults below are tunable in [`src/lib/config.ts`](src/lib/config.ts).

- **Skill states:**
  - **locked:** its prerequisites aren't learned yet
  - **available**
  - **in progress**
  - **learned:** items done, then Recall answered
  - **tested out:** Recall answered before starting
  - **self-reported:** something I already knew
  - **rusty:** a time-sensitive fact is more than 90 days old, or a review failed
- **Test out:** any available skill can be tested out. Answer its Recall questions without notes and grade each answer honestly. If every answer passes, the skill is learned (tested out).
- **XP:** minutes logged × a weight per type. `watch`/`read`/`habit` count ×1, `do` ×1.5, `build`/`output` ×2. Each Recall pass adds +10. Level *L* needs `100·(L−1)^1.8` XP in total.
- **Streak:** counted in weeks, not days. A week counts when at least 2 h are logged.
- **Quest plan:** each stage's items are spread across its weeks by time estimate, and each skill ends with an "answer Recall" step. *This week* shows this week's slice, anything carried over from earlier weeks, and (once both are done) the next items to get ahead on.
