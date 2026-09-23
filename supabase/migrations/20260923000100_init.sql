-- skilltree v1 schema: progress facts only (docs/decisions.md D1, D3).
-- Content lives in git; every row here is keyed by stable content ids
-- (skill id, item id, recall question id, quest id, habit key).
--
-- RLS is enabled on every table with NO policies: the secret key used by the
-- server bypasses RLS, while the publishable/anon key can read nothing (D2).

-- ---------------------------------------------------------------- helpers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger: stamps updated_at on every UPDATE.';

-- ---------------------------------------------------------------- items & skills

create table if not exists public.item_progress (
  skill_id     text not null,
  item_id      text not null,
  status       text not null check (status in ('done', 'skipped')),
  completed_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (skill_id, item_id)
);

comment on table public.item_progress is
  'Done/skipped state per item (skill id + item id). No row means todo.';

create table if not exists public.skill_progress (
  skill_id    text primary key,
  learned_via text check (learned_via in ('completed', 'tested-out', 'self-reported')),
  learned_at  timestamptz,
  started_at  timestamptz,
  starred     boolean not null default false,
  updated_at  timestamptz not null default now()
);

comment on table public.skill_progress is
  'Per-skill facts: how/when it was learned, when it was started, starred. States like locked/rusty are derived, never stored.';

-- ---------------------------------------------------------------- habits & time

create table if not exists public.habit_logs (
  id           uuid primary key default gen_random_uuid(),
  habit_key    text not null,
  period_start date not null,
  done_on      date not null,
  minutes      int check (minutes > 0),
  note         text,
  created_at   timestamptz not null default now(),
  check (period_start <= done_on)
);

create index if not exists habit_logs_habit_key_period_idx
  on public.habit_logs (habit_key, period_start);

comment on table public.habit_logs is
  'One row per habit occurrence. habit_key is `<quest-or-skill id>/<item id>`; period_start is the Monday / 1st of month / Jan 1 of its cadence period (local date).';

create table if not exists public.time_logs (
  id           uuid primary key default gen_random_uuid(),
  skill_id     text,
  item_id      text,
  quest_id     text,
  habit_key    text,
  -- Set when the log was created together with a habit occurrence, so undoing
  -- the habit removes its time too.
  habit_log_id uuid references public.habit_logs (id) on delete cascade,
  activity     text not null check (activity in ('watch', 'read', 'do', 'build', 'output', 'habit', 'review', 'other')),
  minutes      int not null check (minutes > 0 and minutes <= 1440),
  logged_on    date not null,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists time_logs_logged_on_idx on public.time_logs (logged_on);
create index if not exists time_logs_skill_id_idx on public.time_logs (skill_id);
create index if not exists time_logs_habit_log_id_idx on public.time_logs (habit_log_id);

comment on table public.time_logs is
  'Minutes spent, by activity and local date (Europe/Riga). The source of XP and weekly streaks.';

-- ---------------------------------------------------------------- notes

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  skill_id   text,
  item_id    text,
  quest_id   text,
  kind       text not null check (kind in ('note', 'output')),
  title      text,
  body       text not null default '',
  url        text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (skill_id is not null or quest_id is not null)
);

create index if not exists notes_skill_id_idx on public.notes (skill_id);

comment on table public.notes is
  'Markdown notes and outputs (the loot of output items), attached to a skill/item or a quest.';

-- ---------------------------------------------------------------- recall

create table if not exists public.recall_attempts (
  id          uuid primary key default gen_random_uuid(),
  skill_id    text not null,
  question_id text not null,
  mode        text not null check (mode in ('test-out', 'complete', 'review')),
  session_id  uuid not null,
  result      text not null check (result in ('pass', 'fail')),
  answer      text,
  source      text not null default 'app',
  created_at  timestamptz not null default now()
);

create index if not exists recall_attempts_skill_created_idx
  on public.recall_attempts (skill_id, created_at);

comment on table public.recall_attempts is
  'Self-graded answers to Recall questions (test-out, completion check, review). session_id groups one run through a skill; source is "app" or e.g. "claude-review".';

create table if not exists public.recall_cards (
  skill_id         text not null,
  question_id      text not null,
  box              int not null default 1 check (box >= 1),
  due_on           date not null,
  last_result      text check (last_result in ('pass', 'fail')),
  last_reviewed_at timestamptz,
  primary key (skill_id, question_id)
);

comment on table public.recall_cards is
  'Leitner box per Recall question for spaced review; populated when a skill is learned.';

-- ---------------------------------------------------------------- verifications

create table if not exists public.verifications (
  id          uuid primary key default gen_random_uuid(),
  skill_id    text not null,
  item_id     text not null,
  verified_at timestamptz not null default now(),
  changed     boolean not null default false,
  note        text
);

create index if not exists verifications_skill_item_idx
  on public.verifications (skill_id, item_id);

comment on table public.verifications is
  'Re-verifications of time-sensitive items; the latest one resets the item''s freshness window.';

-- ---------------------------------------------------------------- quests

create table if not exists public.quest_runs (
  id             uuid primary key default gen_random_uuid(),
  quest_id       text not null,
  status         text not null check (status in ('active', 'paused', 'completed', 'abandoned')),
  started_on     date not null,
  hours_per_week numeric check (hours_per_week > 0),
  forked_from    uuid references public.quest_runs (id),
  definition     jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- At most one active quest run at a time, across all quests.
create unique index if not exists quest_runs_one_active_idx
  on public.quest_runs (status) where status = 'active';

create index if not exists quest_runs_forked_from_idx on public.quest_runs (forked_from);

comment on table public.quest_runs is
  'A run through a quest: its week-1 Monday and status. The week plan is derived. forked_from/definition are reserved for quest forking.';

-- ---------------------------------------------------------------- updated_at triggers

create or replace trigger item_progress_set_updated_at
  before update on public.item_progress
  for each row execute function public.set_updated_at();

create or replace trigger skill_progress_set_updated_at
  before update on public.skill_progress
  for each row execute function public.set_updated_at();

create or replace trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

create or replace trigger quest_runs_set_updated_at
  before update on public.quest_runs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- row level security

alter table public.item_progress   enable row level security;
alter table public.skill_progress  enable row level security;
alter table public.habit_logs      enable row level security;
alter table public.time_logs       enable row level security;
alter table public.notes           enable row level security;
alter table public.recall_attempts enable row level security;
alter table public.recall_cards    enable row level security;
alter table public.verifications   enable row level security;
alter table public.quest_runs      enable row level security;
