# Decisions

Short records of the architecture calls for v1: what was chosen, why, and what was rejected. The constraints: single user, low maintenance, a tool I open every week, and my usual stack (Next.js + Supabase).

## D1. Content lives in git; progress lives in Supabase

**Chosen:** skills, branches and quests are markdown files in `content/`, one file per unit (see [format-spec.md](./format-spec.md)). Everything I *do* (item states, time, notes, test-outs, verifications, quest runs, habits) lives in Supabase Postgres, keyed by the stable content ids.

**Why:**
- Content is authored by me and, later, by a Claude Code authoring skill that follows the guide and runs the validator. Git gives me diffs, review, history and CI validation for free, the same way roadmap.sh keeps one content file per node.
- Progress changes several times a week from the UI, so it belongs in a database.
- Stable ids (`skill.id`, `skill/item-id`, `q1…`) are the only contract between the two, so content edits never corrupt progress.

**Rejected:**
- *Content in the DB, edited in-app*: needs an editor UI, loses diffs and review rounds, and the validator can't run in CI.
- *Everything local-first (IndexedDB + JSON export)*: I already pay for Supabase, and I want the same progress on laptop and phone.

## D2. Next.js 16 App Router, server-only data access, no auth for now

**Chosen:** Next.js 16 (App Router, React 19, React Compiler), Tailwind v4 and TypeScript. Pages are dynamic server components. They read content from `content/` (parsed on the server; cached in production, re-parsed per request in dev) and progress from Supabase through `supabase-js` with the **secret key, server-side only** (`import 'server-only'`). Mutations are Server Actions followed by `refresh()`.

- **No login.** It runs locally for now, as decided on 2026-09-23. Because the browser never talks to Supabase, adding a passphrase gate later is one `proxy.ts` plus a cookie, with no data-layer changes.
- **RLS is on for every table with no policies**, so the publishable/anon key can read nothing. Only the secret key (server) gets through.

**Rejected:**
- *Supabase Auth + RLS by user_id*: multi-user machinery for a single user (the brief says not to copy multi-user auth).
- *Client-side Supabase*: it would put a key in the browser and duplicate business logic on the client.
- *Cache Components (`cacheComponents: true`)*: every page depends on live progress, so there's nothing worth caching yet.

## D3. Derived state is computed, not stored

**Chosen:** node states (locked → rusty), rank completion, rust, XP, levels, streaks and the quest's week plan are all **pure functions** of `(content, progress rows, today)` in `src/lib/engine/`. The database stores only facts: this item was done at T; I logged 45 min; I passed q2 in a test-out.

**Why:** tuning a game mechanic (XP weights, freshness window, the week plan) never needs a data migration, and the engine is unit-tested without a DB. The data is tiny (hundreds of rows), so loading it all per request is fine.

**Rejected:** *storing skill state or XP columns*. They go stale whenever content or rules change.

## D4. Auto-layout: a radial "constellation" layout, not layered/dagre

**Chosen:** a custom deterministic layout in `src/lib/layout/`:

- I'm the hub at the centre.
- Each branch gets an angular sector (sized by how wide it is).
- A skill's ring is its depth in the prerequisite graph: the longest chain of skill and rank requires, across branches.
- Within a ring, nodes are ordered by the barycentre of their parents, to cut edge crossings.
- Cross-branch edges are drawn as curves blending the two branch colours.

It's rendered with React Flow (`@xyflow/react`, MIT) for pan, zoom and hit-testing, with custom orb nodes and edges.

**Why:** the brief says "feel like a game skill tree, not an org chart". A layered top-down layout (dagre/ELK) is exactly an org chart. The radial layout reads like a Path of Exile tree or a constellation, grows naturally as branches are added, and is still derived entirely from prerequisites (Human Skill Tree hand-configures positions; we don't).

**Rejected:**
- *dagre/ELK layered*: org-chart look.
- *force-directed*: non-deterministic; nodes jump between visits.
- *hand-placed coordinates*: maintenance burden.

## D5. The validator is part of the content library, not a separate tool

**Chosen:** one parser (`src/lib/content/parse*.ts`) produces a typed AST with line numbers. The same AST feeds the validator (`pnpm validate`), the importer and the app. The validator runs:

- in a pre-commit hook (`simple-git-hooks`, only when content or the library changes)
- in GitHub Actions CI, together with typecheck, lint, tests and build

**Why:** a single parser means the app and the validator can't disagree about what a file means.

## D6. Progress model

These are the defaults from guide §7, tuned for weekly 4–5 h blocks. All the constants are in `src/lib/config.ts`.

- **Item states:** todo / done / skipped. Skipped doesn't block its rank. Optional items and habits never block.
- **Skill learned** has three routes:
  - *completed*: every rank's required items are done or skipped, then Recall is answered in the completion check
  - *tested out*: all Recall answered before starting
  - *self-reported*: a starting skill, or "I already know this"
  Recall grading is self-assessed: the questions have no answer keys, so I type an answer and mark it got it / not yet.
- **Locked:** a skill-level `requires` isn't learned. A rank-level `requires` locks just that rank.
- **Rust:** a learned skill with a time-sensitive item past the 90-day window turns rusty. So does a failed review, once spaced review exists. Unlearned skills show a stale-facts flag instead.
- **XP:** minutes logged × weight:
  - `watch`/`read`/`habit` ×1
  - `do` ×1.5
  - `build`/`output` ×2
  - plus 10 XP per Recall question passed
  Opening things earns nothing. Level *L* needs `100·(L−1)^1.8` XP in total.
- **Streak:** weekly, not daily. A week counts if I logged ≥ 2 h.
- **Weeks:** ISO weeks (Monday start) in Europe/Riga.

## D7. Quest week plan

**Chosen:** a quest run stores only its start Monday. The engine lays the stage's items out across the stage's weeks by cumulative time estimate, with a "complete the skill with Recall" step after each skill. "This week" shows:

- this week's slice
- anything left over from earlier weeks, as carry-over
- when this week's slice is done, the next items, as "get ahead"

**Why:** the plan adapts to what I've actually done, with no schedule rows to maintain. Test-outs and self-reports simply clear their items.

**Later (fits without schema changes):** forking a quest is a new `quest_runs` row with `forked_from` and a `definition` override (JSON). Spaced review uses the existing `recall_attempts` and `recall_cards` tables, `mode = 'review'`. The Claude Code review skill writes `recall_attempts` with `source = 'claude-review'` through `pnpm progress:import` (the same JSON format as the in-app export).

## D8. Migrations

**Chosen:** plain SQL files in `supabase/migrations/` (Supabase CLI naming), applied by `pnpm db:migrate`. The script uses `pg` and `SUPABASE_DB_URL`, and it records applied versions in `supabase_migrations.schema_migrations`, the same table the Supabase CLI uses. Switching to `supabase db push` later needs no changes.

**Note:** the direct DB host is IPv6-only, so `SUPABASE_DB_URL` uses the IPv4 **session pooler** (`aws-1-eu-west-1.pooler.supabase.com:5432`).

**Rejected:** *an ORM with generated migrations (Drizzle/Prisma)*. That's another tool to learn and keep in sync, for nine small tables.

## D9. What v1 deliberately doesn't do

- no spaced-review UI
- no `@search@` resolver
- no quest forking UI
- no AI generation
- no auth
- no multi-user support

The data model leaves room for each of these (see D7).
