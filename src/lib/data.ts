import "server-only";
import { cache } from "react";
import { getContent } from "@/lib/content/server";
import { loadSnapshot } from "@/lib/db/snapshot";
import { localToday } from "@/lib/engine/dates";
import { computeHabits } from "@/lib/engine/habits";
import { activeQuestWeeks, computeQuestViews } from "@/lib/engine/quest";
import { computeTreeState } from "@/lib/engine/state";

/**
 * Everything a page needs, computed once per request: content, the raw
 * progress snapshot and all derived state (docs/decisions.md D3).
 */
export const getAppData = cache(async () => {
  const snapshot = await loadSnapshot();
  const { tree, index } = getContent();
  const today = localToday();
  const state = computeTreeState(index, snapshot, today);
  const quests = computeQuestViews(index, snapshot, state, today);
  const habits = computeHabits(index, snapshot, state, activeQuestWeeks(quests), today);
  const activeQuest = quests.find((q) => q.status === "active") ?? null;
  return { tree, index, snapshot, today, state, quests, habits, activeQuest };
});

export type AppData = Awaited<ReturnType<typeof getAppData>>;
