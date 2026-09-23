// Labels for the progress tables in export/import summaries. Kept free of
// runtime imports so client components can use it without pulling in zod.

import type { SnapshotTable } from "@/lib/progress/export";

export const TABLE_ORDER: SnapshotTable[] = [
  "items",
  "skills",
  "timeLogs",
  "notes",
  "recallAttempts",
  "recallCards",
  "verifications",
  "questRuns",
  "habitLogs",
];

export const TABLE_LABELS: Record<SnapshotTable, string> = {
  items: "Item progress",
  skills: "Skill progress",
  timeLogs: "Time logs",
  notes: "Notes & outputs",
  recallAttempts: "Recall answers",
  recallCards: "Recall cards",
  verifications: "Verifications",
  questRuns: "Quest runs",
  habitLogs: "Habit check-offs",
};
