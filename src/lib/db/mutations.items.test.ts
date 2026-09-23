// setItemStatus makes several PostgREST writes with no transaction between
// them. The time log goes last, so a failure part-way never leaves logged
// minutes behind for a retry to log again.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { setItemStatus } from "@/lib/db/mutations";

type Result = { data: null; error: { message: string } | null };

/** Records `table.operation` calls; the first call on `failOn` errors. */
function recordingClient(failOn: string | null) {
  const calls: string[] = [];
  const query = (table: string, op: string) => {
    const name = `${table}.${op}`;
    const failed = failOn !== null && name === failOn && !calls.some((c) => c.startsWith(`${name} `));
    calls.push(failed ? `${name} -> ERROR` : name);
    const result: Result = { data: null, error: failed ? { message: "simulated failure" } : null };
    const chain: Record<string, unknown> & PromiseLike<Result> = {
      eq: () => chain,
      is: () => chain,
      then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return chain;
  };
  const client = {
    from: (table: string) => ({
      upsert: () => query(table, "upsert"),
      insert: () => query(table, "insert"),
      update: () => query(table, "update"),
      delete: () => query(table, "delete"),
    }),
  };
  return { calls, client: client as unknown as SupabaseClient };
}

const DONE = { skillId: "s.a", itemId: "one", status: "done", minutes: 45, activity: "read" } as const;

describe("setItemStatus write order", () => {
  it("marks the item, starts the skill, then logs the time", async () => {
    const { calls, client } = recordingClient(null);
    await setItemStatus(client, DONE);
    expect(calls).toEqual(["item_progress.upsert", "skill_progress.upsert", "skill_progress.update", "time_logs.insert"]);
  });

  it("logs no time when an earlier write fails, so retrying can't count the minutes twice", async () => {
    const { calls, client } = recordingClient("skill_progress.upsert");
    await expect(setItemStatus(client, DONE)).rejects.toThrow(/Starting skill: simulated failure/);
    expect(calls).toEqual(["item_progress.upsert", "skill_progress.upsert -> ERROR"]);
  });

  it("skips the time log without minutes", async () => {
    const { calls, client } = recordingClient(null);
    await setItemStatus(client, { ...DONE, minutes: null });
    expect(calls).not.toContain("time_logs.insert");
  });
});
