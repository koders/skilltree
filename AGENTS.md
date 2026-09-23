# skilltree

My personal, real-life skill tree: branches → skills (nodes with prerequisites) → ranks → items, plus quests (scheduled routes through the tree), maintenance habits, test-outs and rust. Single user, low maintenance.

- Brief: `docs/starter-prompt.md` · Content standard: `docs/skill-authoring-guide.md` · Storage format: `docs/format-spec.md` · Architecture: `docs/decisions.md`
- **Content** lives in `content/` (markdown, one file per skill/branch/quest) and is validated by `pnpm validate`. **Progress** lives in Supabase Postgres (`supabase/migrations/`), accessed server-side only with the secret key.
- Derived state (node states, rust, XP, quest week plan) is computed by pure functions in `src/lib/engine/` — never stored.

## Commands

```bash
pnpm dev                 # Next.js dev server
pnpm validate [path]     # validate content/ (or a *.skilltree.md bundle); --json for tools
pnpm content:import <bundle.skilltree.md>   # split a bundle into content/
pnpm content:ids         # add missing {#ids} to items / recall questions
pnpm db:migrate          # apply supabase/migrations with SUPABASE_DB_URL
pnpm test                # vitest
pnpm typecheck           # next typegen + tsc
pnpm check               # validate + typecheck + lint + test
```

## Conventions

- Stable ids are the contract between content and progress: never change a skill id, item `{#id}` or recall `{#qN}` once it exists.
- Dates in the app are local `YYYY-MM-DD` in Europe/Riga (`src/lib/engine/dates.ts`); timestamps in the DB are UTC `timestamptz`.
- Game tunables (XP weights, freshness window, streak threshold) live in `src/lib/config.ts`.
- Env: `SUPABASE_PROJECT_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL` (IPv4 session pooler) in `.env.local`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
