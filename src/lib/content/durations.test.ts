import { describe, expect, it } from "vitest";
import { formatMinutes, parseDuration, parseEstimate, scanDurations } from "@/lib/content/durations";

describe("parseDuration", () => {
  it.each([
    ["~30 min", 30, null],
    ["~1 h", 60, null],
    ["~1.5 h", 90, null],
    ["~1 h 30 min", 90, null],
    ["~45 min at 1.5x", 45, "at 1.5x"],
    ["~1 h total", 60, "total"],
    ["~1–2 h", 120, null],
    ["~1-2 h", 120, null],
    ["~10–15 min", 15, null],
    ["~2 hours", 120, null],
    ["~20 mins", 20, null],
    ["~3 hr", 180, null],
    ["45 minutes", 45, null],
    ["  ~1 h at 1.5x  ", 60, "at 1.5x"],
    // Ranges whose ends have different units still count at the upper bound (spec §6.1).
    ["~45 min–1 h", 60, null],
    ["~45 min - 1 h total", 60, "total"],
    ["~1 h 30 min – 2 h", 120, null],
    ["~30–45 min", 45, null],
    // "1h30" shorthand: digits glued to the hours unit are minutes.
    ["~1h30", 90, null],
    ["~1h30m at 2x", 90, "at 2x"],
    ["~1 h 30", 60, "30"],
  ])("%s → %d min", (text, minutes, note) => {
    expect(parseDuration(text)).toEqual({ minutes, note });
  });

  it.each(["", "~", "~soon", "about an hour", "~30", "~5 hamburgers", "h 30"])("rejects %j", (text) => {
    expect(parseDuration(text)).toBeNull();
  });
});

describe("scanDurations", () => {
  it("finds every duration and combines h + min", () => {
    const text = "~3.5 h + optional book (~6 h), then 1 h 15 min";
    expect(scanDurations(text)).toEqual([
      { minutes: 210, index: 0 },
      { minutes: 360, index: text.indexOf("~6") },
      { minutes: 75, index: text.indexOf("1 h 15") },
    ]);
  });

  it("ignores numbers without a unit and digits inside words", () => {
    expect(scanDurations("week 13, 1.5x, v2h")).toEqual([]);
  });
});

describe("parseEstimate", () => {
  it("splits core and optional hours (spec §6.2)", () => {
    expect(parseEstimate("~3.5 h + optional book (~6 h)")).toEqual({
      text: "~3.5 h + optional book (~6 h)",
      hours: 3.5,
      optionalHours: 6,
    });
    expect(parseEstimate("~2 h (+1 h optional)")).toEqual({ text: "~2 h (+1 h optional)", hours: 2, optionalHours: 1 });
  });

  it("treats comma- and semicolon-separated parts like + parts", () => {
    expect(parseEstimate("~2 h, plus ~1 h optional")).toEqual({ text: "~2 h, plus ~1 h optional", hours: 2, optionalHours: 1 });
    expect(parseEstimate("~3 h; optional extras ~30 min")).toMatchObject({ hours: 3, optionalHours: 0.5 });
  });

  it("keeps other trailing text for display only", () => {
    expect(parseEstimate("~3 h + monthly habits")).toEqual({ text: "~3 h + monthly habits", hours: 3, optionalHours: null });
  });

  it("returns null hours when nothing parses", () => {
    expect(parseEstimate("TBD")).toEqual({ text: "TBD", hours: null, optionalHours: null });
  });

  it("handles minutes-only estimates", () => {
    expect(parseEstimate("~45 min").hours).toBe(0.75);
  });
});

describe("formatMinutes", () => {
  it.each([
    [20, "~20 min"],
    [30, "~30 min"],
    [60, "~1 h"],
    [90, "~1.5 h"],
    [120, "~2 h"],
    [75, "~1 h 15 min"],
    [150, "~2.5 h"],
    [0, "~0 min"],
  ])("%d → %s", (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });

  it("round-trips through parseDuration", () => {
    for (const m of [5, 20, 45, 60, 75, 90, 135, 240]) expect(parseDuration(formatMinutes(m))?.minutes).toBe(m);
  });
});
