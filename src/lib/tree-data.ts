import "server-only";
import type { AppData } from "@/lib/data";
import type { ActiveQuestSummary, TreeData } from "@/lib/view-model";

export function buildTreeData(app: AppData): TreeData {
  const q = app.activeQuest;
  let activeQuest: ActiveQuestSummary | null = null;
  if (q) {
    const entries = [...(q.thisWeek?.entries ?? []), ...(q.thisWeek?.carryOver ?? [])];
    activeQuest = {
      id: q.questId,
      title: app.index.quests[q.questId]?.title ?? q.questId,
      currentWeek: q.currentWeek,
      thisWeekSkillIds: [...new Set(entries.map((e) => e.skillId))],
      thisWeekItemKeys: entries.filter((e) => e.kind === "item").map((e) => e.key),
    };
  }
  return {
    today: app.today,
    branches: app.tree.branches,
    skills: app.tree.skills,
    state: app.state,
    notes: app.snapshot.notes,
    timeLogs: app.snapshot.timeLogs,
    recallAttempts: app.snapshot.recallAttempts,
    verifications: app.snapshot.verifications,
    activeQuest,
  };
}
