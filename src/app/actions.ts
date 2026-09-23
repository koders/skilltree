"use server";

// Server Actions: thin wrappers over src/lib/db/mutations.ts. Each validates
// its input (the mutation parses it with zod), never throws to the client,
// and refreshes the router after a successful write (docs/decisions.md D2).

import { refresh } from "next/cache";
import { ZodError } from "zod";
import { getContent } from "@/lib/content/server";
import { db } from "@/lib/db/client";
import * as m from "@/lib/db/mutations";
import type { ImportCounts } from "@/lib/progress/export";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function describeError(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues
      .slice(0, 5)
      .map((i) => (i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
  }
  return err instanceof Error ? err.message : String(err);
}

async function run<T>(name: string, write: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await write();
    refresh();
    return { ok: true, data };
  } catch (err) {
    console.error(`[action ${name}]`, err);
    return { ok: false, error: describeError(err) };
  }
}

// ---------------------------------------------------------------- items & time

export async function setItemStatus(input: m.SetItemStatusInput): Promise<ActionResult<null>> {
  return run("setItemStatus", async () => {
    await m.setItemStatus(db(), input);
    return null;
  });
}

export async function logTime(input: m.LogTimeInput): Promise<ActionResult<{ id: string }>> {
  return run("logTime", () => m.logTime(db(), input));
}

export async function deleteTimeLog(input: m.IdInput): Promise<ActionResult<null>> {
  return run("deleteTimeLog", async () => {
    await m.deleteTimeLog(db(), input);
    return null;
  });
}

// ---------------------------------------------------------------- notes

export async function saveNote(input: m.SaveNoteInput): Promise<ActionResult<{ id: string }>> {
  return run("saveNote", () => m.saveNote(db(), input));
}

export async function deleteNote(input: m.IdInput): Promise<ActionResult<null>> {
  return run("deleteNote", async () => {
    await m.deleteNote(db(), input);
    return null;
  });
}

// ---------------------------------------------------------------- recall & skills

export async function submitRecall(input: m.SubmitRecallInput): Promise<ActionResult<m.SubmitRecallResult>> {
  return run("submitRecall", () => {
    const { index } = getContent();
    return m.submitRecall(db(), input, (skillId) => index.skills[skillId]);
  });
}

export async function selfReportSkill(input: m.SkillIdInput): Promise<ActionResult<null>> {
  return run("selfReportSkill", async () => {
    await m.selfReportSkill(db(), input);
    return null;
  });
}

export async function resetSkill(input: m.SkillIdInput): Promise<ActionResult<null>> {
  return run("resetSkill", async () => {
    await m.resetSkill(db(), input);
    return null;
  });
}

export async function setSkillStarred(input: m.SetSkillStarredInput): Promise<ActionResult<null>> {
  return run("setSkillStarred", async () => {
    await m.setSkillStarred(db(), input);
    return null;
  });
}

export async function startSkill(input: m.SkillIdInput): Promise<ActionResult<null>> {
  return run("startSkill", async () => {
    await m.startSkill(db(), input);
    return null;
  });
}

export async function verifyItem(input: m.VerifyItemInput): Promise<ActionResult<{ id: string }>> {
  return run("verifyItem", () => m.verifyItem(db(), input));
}

// ---------------------------------------------------------------- quests

export async function startQuest(input: m.StartQuestInput): Promise<ActionResult<{ id: string }>> {
  return run("startQuest", () => m.startQuest(db(), input));
}

export async function setQuestRunStatus(input: m.SetQuestRunStatusInput): Promise<ActionResult<null>> {
  return run("setQuestRunStatus", async () => {
    await m.setQuestRunStatus(db(), input);
    return null;
  });
}

export async function updateQuestRun(input: m.UpdateQuestRunInput): Promise<ActionResult<null>> {
  return run("updateQuestRun", async () => {
    await m.updateQuestRun(db(), input);
    return null;
  });
}

// ---------------------------------------------------------------- habits

export async function logHabit(input: m.LogHabitInput): Promise<ActionResult<{ id: string }>> {
  return run("logHabit", () => m.logHabit(db(), input));
}

export async function undoHabit(input: m.UndoHabitInput): Promise<ActionResult<null>> {
  return run("undoHabit", async () => {
    await m.undoHabit(db(), input);
    return null;
  });
}

// ---------------------------------------------------------------- import

export async function importProgress(input: m.ImportProgressInput): Promise<ActionResult<ImportCounts>> {
  return run("importProgress", () => m.importProgress(db(), input));
}
