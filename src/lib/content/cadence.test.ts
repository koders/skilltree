import { describe, expect, it } from "vitest";
import { formatCadence, inferCadenceFromTitle, parseCadence } from "@/lib/content/cadence";

describe("parseCadence", () => {
  it.each([
    ["weekly", "week", 1, "weekly"],
    ["Monthly", "month", 1, "monthly"],
    ["yearly", "year", 1, "yearly"],
    ["annually", "year", 1, "yearly"],
    ["2× week", "week", 2, "2× week"],
    ["2x weekly", "week", 2, "2× week"],
    ["2x/week", "week", 2, "2× week"],
    ["twice a week", "week", 2, "2× week"],
    ["3 times a month", "month", 3, "3× month"],
    ["3x month", "month", 3, "3× month"],
    ["once a year", "year", 1, "yearly"],
    ["every month", "month", 1, "monthly"],
    ["week", "week", 1, "weekly"],
    // Hyphenated forms must not fall through to the bare adjective ("weekly" → 1×).
    ["twice-weekly", "week", 2, "2× week"],
    ["3x-monthly", "month", 3, "3× month"],
  ])("%s", (text, unit, times, display) => {
    expect(parseCadence(text)).toEqual({ unit, times, text: display });
  });

  it.each(["", "daily", "biweekly", "sometimes", "~2 h/week"])("rejects %j", (text) => {
    expect(parseCadence(text)).toBeNull();
  });
});

describe("inferCadenceFromTitle", () => {
  it("reads the seed's habit wording", () => {
    expect(inferCadenceFromTitle("Technical depth, one episode a month: [@podcast@Epicenter](https://epicenter.tv)")).toMatchObject({
      unit: "month",
      times: 1,
    });
    expect(inferCadenceFromTitle("Annual big-picture reports as they come out")).toMatchObject({ unit: "year", times: 1 });
    expect(inferCadenceFromTitle("Terminal, 10 min twice a week: staking feed")).toMatchObject({ unit: "week", times: 2 });
    expect(inferCadenceFromTitle("Unchained's weekly news episode")).toMatchObject({ unit: "week", times: 1 });
  });

  it("counts things, not time budgets", () => {
    expect(inferCadenceFromTitle("Two deep dives a month")).toMatchObject({ unit: "month", times: 2 });
    expect(inferCadenceFromTitle("30 min per week of reading")).toMatchObject({ unit: "week", times: 1 });
  });

  it("returns null when nothing is inferable", () => {
    expect(inferCadenceFromTitle("One Bankless or Empire episode on a topic I haven't covered yet")).toBeNull();
    expect(inferCadenceFromTitle("Pick the biggest reward-rate move on SR that week")).toBeNull();
    expect(inferCadenceFromTitle("Perpetual futures, tracked live for a week")).toBeNull();
  });

  it("ignores URLs", () => {
    expect(inferCadenceFromTitle("[@feed@Digest](https://example.com/weekly-digest)")).toBeNull();
  });
});

describe("formatCadence", () => {
  it("uses adjectives for once per period", () => {
    expect(formatCadence("week", 1)).toBe("weekly");
    expect(formatCadence("month", 3)).toBe("3× month");
  });
});
