import { describe, expect, it } from "vitest";
import { buildFeed } from "@/components/journal/feed";
import { makeIndex, makeSnapshot, sampleSkills, testOutSession } from "@/lib/engine/__fixtures__/content";

const TODAY = "2026-09-23";
const index = makeIndex({ skills: sampleSkills() });

function recallEntries(failed: string[], mode: "test-out" | "complete" = "test-out") {
  const attempts = testOutSession("a.basics", ["q1", "q2", "q3"], { sessionId: "s", createdAt: "2026-09-22T10:00:00Z", failed }).map((a) => ({
    ...a,
    mode,
  }));
  return buildFeed(index, makeSnapshot({ recallAttempts: attempts }), TODAY)
    .flatMap((d) => d.entries)
    .filter((e) => e.kind === "recall");
}

describe("buildFeed: recall sessions", () => {
  it("says 'Tested out of' only when every answer passed", () => {
    expect(recallEntries([])).toMatchObject([{ verb: "Tested out of", detail: "3/3 recall", tone: "gold" }]);
  });

  it("calls a failed test-out an attempt, not a test-out", () => {
    expect(recallEntries(["q2", "q3"])).toMatchObject([{ verb: "Test-out attempt on", detail: "1/3 recall", tone: "default" }]);
  });

  it("keeps completion checks neutral either way", () => {
    expect(recallEntries(["q1"], "complete")).toMatchObject([{ verb: "Completion check for" }]);
  });
});
