import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  diffDays,
  isIsoDate,
  localDate,
  periodEnd,
  periodStart,
  previousPeriodStart,
  startOfWeek,
  weekNumber,
} from "@/lib/engine/dates";

describe("dates", () => {
  it("converts instants to Riga calendar dates", () => {
    // 2026-09-16 21:34Z is already the 17th in Riga (UTC+3 in September).
    expect(localDate("2026-09-16T21:34:00Z")).toBe("2026-09-17");
    // Winter: UTC+2.
    expect(localDate("2026-12-31T21:59:00Z")).toBe("2026-12-31");
    expect(localDate("2026-12-31T22:00:00Z")).toBe("2027-01-01");
  });

  it("does day arithmetic across DST", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("finds ISO week starts (Monday)", () => {
    expect(startOfWeek("2026-09-23")).toBe("2026-09-21"); // Wednesday
    expect(startOfWeek("2026-09-27")).toBe("2026-09-21"); // Sunday
    expect(startOfWeek("2026-09-21")).toBe("2026-09-21");
  });

  it("handles cadence periods", () => {
    expect(periodStart("2026-09-23", "month")).toBe("2026-09-01");
    expect(periodEnd("2026-02-01", "month")).toBe("2026-02-28");
    expect(periodEnd("2026-09-21", "week")).toBe("2026-09-27");
    expect(previousPeriodStart("2026-01-01", "month")).toBe("2025-12-01");
    expect(previousPeriodStart("2026-01-01", "year")).toBe("2025-01-01");
    expect(addMonths("2026-11-01", 3)).toBe("2027-02-01");
  });

  it("numbers quest weeks", () => {
    expect(weekNumber("2026-09-21", "2026-09-21")).toBe(1);
    expect(weekNumber("2026-09-21", "2026-09-27")).toBe(1);
    expect(weekNumber("2026-09-21", "2026-09-28")).toBe(2);
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2026-09-23")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("23.09.2026")).toBe(false);
  });
});
