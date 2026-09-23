// The serialisable payload the tree page hands to its client components.
// Built on the server from getAppData(); plain data only.

import type { Branch, Skill } from "@/lib/content/types";
import type { TreeState } from "@/lib/engine/types";
import type { NoteRow, RecallAttemptRow, TimeLogRow, VerificationRow } from "@/lib/progress/types";

export interface ActiveQuestSummary {
  id: string;
  title: string;
  currentWeek: number | null;
  /** Skills with entries planned for (or carried over into) the current week. */
  thisWeekSkillIds: string[];
  /** Item keys planned for (or carried over into) the current week. */
  thisWeekItemKeys: string[];
}

export interface TreeData {
  today: string;
  branches: Branch[];
  skills: Skill[];
  state: TreeState;
  notes: NoteRow[];
  timeLogs: TimeLogRow[];
  recallAttempts: RecallAttemptRow[];
  verifications: VerificationRow[];
  activeQuest: ActiveQuestSummary | null;
}
