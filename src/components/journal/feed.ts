// The journal's activity feed: every progress fact as one timeline entry,
// newest first, grouped by local (Riga) day. Pure; built on the server.

import type { ContentIndex } from "@/lib/content/types";
import type { PlanEntryType } from "@/lib/engine/types";
import { xpForLog } from "@/lib/engine/xp";
import type { Activity, ProgressSnapshot, RecallAttemptRow, TimeLogRow } from "@/lib/progress/types";
import { branchColor } from "@/components/ui/meta";
import { dayOf, fmtClock, plainText, relativeDay } from "./format";

export type FeedIcon = PlanEntryType | "note" | "verify" | "time" | "learned" | "review" | "other";

export interface FeedEntry {
  id: string;
  kind: "time" | "item" | "recall" | "verify" | "habit" | "note" | "learned";
  /** Local date the entry belongs to. */
  day: string;
  /** Sort key (ISO instant). */
  at: string;
  /** Riga clock time, when the entry happened on `day` (not for back-dated logs). */
  clock: string | null;
  icon: FeedIcon;
  /** Plain text. */
  title: string;
  /** What happened, e.g. "Completed", "Tested out". */
  verb: string;
  detail: string | null;
  tone: "default" | "gold" | "rust" | "dim";
  skillId: string | null;
  skillTitle: string | null;
  color: string;
  minutes: number | null;
  xp: number | null;
  /** Time log this entry can delete (its own, or the one folded into an item completion). */
  timeLogId: string | null;
}

export interface FeedDay {
  day: string;
  label: string;
  entries: FeedEntry[];
  minutes: number;
}

/** A completion and the time logged with it are written seconds apart. */
const FOLD_WINDOW_MS = 120_000;
const MAX_ENTRIES = 150;

const ACTIVITY_LABEL: Record<Activity, string> = {
  watch: "Watch",
  read: "Read",
  do: "Do",
  build: "Build",
  output: "Output",
  habit: "Habit",
  review: "Review",
  other: "Other",
};

function activityIcon(activity: string): FeedIcon {
  if (activity === "review") return "review";
  if (activity in ACTIVITY_LABEL && activity !== "other") return activity as FeedIcon;
  return "time";
}

export function buildFeed(index: ContentIndex, snapshot: ProgressSnapshot, today: string): FeedDay[] {
  const branchIndex = new Map(index.tree.branches.map((b, i) => [b.id, i]));
  const skillInfo = (skillId: string | null) => {
    if (!skillId) return { skillId: null, skillTitle: null, color: "var(--gold)" };
    const skill = index.skills[skillId];
    const branch = skill ? index.branches[skill.branchId] : undefined;
    return {
      skillId,
      skillTitle: skill?.title ?? skillId,
      color: branch ? branchColor(branch, branchIndex.get(branch.id) ?? 0) : "var(--mist)",
    };
  };
  const itemTitle = (skillId: string | null, itemId: string | null) => {
    if (!skillId || !itemId) return null;
    const item = index.items[`${skillId}/${itemId}`];
    return item ? plainText(item.title) : itemId;
  };
  const clockIf = (iso: string, day: string) => (dayOf(iso) === day ? fmtClock(iso) : null);

  const entries: FeedEntry[] = [];
  const folded = new Set<string>();

  // Item completions, with the time logged in the same action folded in.
  for (const row of snapshot.items) {
    const done = Date.parse(row.completedAt);
    const log = snapshot.timeLogs.find(
      (l) =>
        !folded.has(l.id) &&
        l.skillId === row.skillId &&
        l.itemId === row.itemId &&
        !l.habitLogId &&
        Math.abs(Date.parse(l.createdAt) - done) < FOLD_WINDOW_MS,
    );
    if (log) folded.add(log.id);
    const item = index.items[`${row.skillId}/${row.itemId}`];
    const day = dayOf(row.completedAt);
    entries.push({
      id: `item:${row.skillId}/${row.itemId}`,
      kind: "item",
      day,
      at: row.completedAt,
      clock: fmtClock(row.completedAt),
      icon: item?.type ?? "other",
      title: itemTitle(row.skillId, row.itemId) ?? row.itemId,
      verb: row.status === "done" ? "Completed" : "Skipped",
      detail: null,
      tone: row.status === "done" ? "default" : "dim",
      ...skillInfo(row.skillId),
      minutes: log?.minutes ?? null,
      xp: log ? xpForLog(log.activity, log.minutes) : null,
      timeLogId: log?.id ?? null,
    });
  }

  for (const log of snapshot.timeLogs) {
    if (folded.has(log.id) || log.habitLogId) continue;
    entries.push(timeEntry(log, itemTitle(log.skillId, log.itemId), skillInfo(log.skillId), clockIf));
  }

  for (const log of snapshot.habitLogs) {
    const item = index.items[log.habitKey];
    const ownerId = log.habitKey.split("/")[0];
    const isSkill = Boolean(index.skills[ownerId]);
    const at = log.createdAt;
    entries.push({
      id: `habit:${log.id}`,
      kind: "habit",
      day: log.doneOn,
      at: dayOf(at) === log.doneOn ? at : `${log.doneOn}T12:00:00Z`,
      clock: clockIf(at, log.doneOn),
      icon: "habit",
      title: item ? plainText(item.title) : log.habitKey,
      verb: "Checked off",
      detail: log.note,
      tone: "default",
      ...(isSkill ? skillInfo(ownerId) : { skillId: null, skillTitle: index.quests[ownerId]?.title ?? null, color: "var(--gold)" }),
      minutes: log.minutes,
      xp: log.minutes ? xpForLog("habit", log.minutes) : null,
      timeLogId: null,
    });
  }

  const sessions = new Map<string, RecallAttemptRow[]>();
  for (const a of snapshot.recallAttempts) sessions.set(a.sessionId, [...(sessions.get(a.sessionId) ?? []), a]);
  for (const [sessionId, rows] of sessions) {
    const first = rows.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
    const passed = rows.filter((r) => r.result === "pass").length;
    const info = skillInfo(first.skillId);
    const verb = first.mode === "test-out" ? "Tested out of" : first.mode === "complete" ? "Completion check for" : "Reviewed";
    const all = passed === rows.length;
    const day = dayOf(first.createdAt);
    entries.push({
      id: `recall:${sessionId}`,
      kind: "recall",
      day,
      at: first.createdAt,
      clock: fmtClock(first.createdAt),
      icon: "recall",
      title: info.skillTitle ?? first.skillId,
      verb,
      detail: `${passed}/${rows.length} recall${first.source !== "app" ? ` · via ${first.source}` : ""}`,
      tone: all ? "gold" : "default",
      ...info,
      minutes: null,
      xp: null,
      timeLogId: null,
    });
  }

  for (const v of snapshot.verifications) {
    const day = dayOf(v.verifiedAt);
    entries.push({
      id: `verify:${v.id}`,
      kind: "verify",
      day,
      at: v.verifiedAt,
      clock: fmtClock(v.verifiedAt),
      icon: "verify",
      title: itemTitle(v.skillId, v.itemId) ?? v.itemId,
      verb: "Re-verified",
      detail: v.changed ? `Fact changed${v.note ? `: ${v.note}` : " — content needs an edit"}` : v.note ?? "Still accurate",
      tone: v.changed ? "rust" : "default",
      ...skillInfo(v.skillId),
      minutes: null,
      xp: null,
      timeLogId: null,
    });
  }

  for (const n of snapshot.notes) {
    const day = dayOf(n.createdAt);
    const info = n.skillId ? skillInfo(n.skillId) : { skillId: null, skillTitle: n.questId ? (index.quests[n.questId]?.title ?? null) : null, color: "var(--gold)" };
    const preview = plainText(n.body).replace(/\s+/g, " ").slice(0, 140);
    entries.push({
      id: `note:${n.id}`,
      kind: "note",
      day,
      at: n.createdAt,
      clock: fmtClock(n.createdAt),
      icon: n.kind === "output" ? "output" : "note",
      title: n.title ?? (n.itemId ? (itemTitle(n.skillId, n.itemId) ?? "Untitled") : preview || "Untitled"),
      verb: n.kind === "output" ? "Collected output" : "Wrote a note",
      detail: n.title || n.itemId ? preview || null : null,
      tone: n.kind === "output" ? "gold" : "default",
      ...info,
      minutes: null,
      xp: null,
      timeLogId: null,
    });
  }

  for (const s of snapshot.skills) {
    if (s.learnedVia !== "self-reported" || !s.learnedAt) continue;
    const day = dayOf(s.learnedAt);
    const info = skillInfo(s.skillId);
    entries.push({
      id: `learned:${s.skillId}`,
      kind: "learned",
      day,
      at: s.learnedAt,
      clock: fmtClock(s.learnedAt),
      icon: "learned",
      title: info.skillTitle ?? s.skillId,
      verb: "Marked as known",
      detail: null,
      tone: "default",
      ...info,
      minutes: null,
      xp: null,
      timeLogId: null,
    });
  }

  entries.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const days: FeedDay[] = [];
  for (const e of entries.slice(0, MAX_ENTRIES)) {
    let group = days.at(-1);
    if (!group || group.day !== e.day) {
      group = { day: e.day, label: relativeDay(e.day, today), entries: [], minutes: 0 };
      days.push(group);
    }
    group.entries.push(e);
    group.minutes += e.minutes ?? 0;
  }
  return days;
}

function timeEntry(
  log: TimeLogRow,
  itemTitle: string | null,
  info: { skillId: string | null; skillTitle: string | null; color: string },
  clockIf: (iso: string, day: string) => string | null,
): FeedEntry {
  const label = ACTIVITY_LABEL[log.activity as Activity] ?? log.activity;
  const clock = clockIf(log.createdAt, log.loggedOn);
  return {
    id: `time:${log.id}`,
    kind: "time",
    day: log.loggedOn,
    at: clock ? log.createdAt : `${log.loggedOn}T12:00:00Z`,
    clock,
    icon: activityIcon(log.activity),
    title: itemTitle ?? (log.note ? log.note.slice(0, 120) : `${label} session`),
    verb: "Logged time",
    detail: itemTitle && log.note ? log.note : null,
    tone: "default",
    ...info,
    minutes: log.minutes,
    xp: xpForLog(log.activity, log.minutes),
    timeLogId: log.id,
  };
}
