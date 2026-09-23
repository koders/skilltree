import { describe, expect, it } from "vitest";
import { frontierSkills } from "@/components/tree/frontier";

const PAD = { top: 84, bottom: 64, left: 16, right: 16 };
const PHONE = { width: 390, height: 844 - 56, padding: PAD };
const DESKTOP = { width: 1440, height: 900 - 56, padding: { top: 56, bottom: 32, left: 300, right: 72 } };
const SIZES = { node: 64, hub: 120 };

// The day-one frontier the review measured: Money bottom-left, Market Intelligence far left, Consensus top-right.
const SKILLS = [
  { id: "money", x: -170, y: 220 },
  { id: "mi", x: -690, y: 430 },
  { id: "consensus", x: 40, y: -250 },
];

describe("frontierSkills", () => {
  it("frames every skill in play when they fit at a readable zoom", () => {
    expect(frontierSkills(SKILLS, SIZES, DESKTOP, 0.65).sort()).toEqual(["consensus", "mi", "money"]);
  });

  it("drops the farthest from the hub on a phone, instead of cropping the hub off-screen", () => {
    expect(frontierSkills(SKILLS, SIZES, PHONE, 0.65).sort()).toEqual(["consensus", "money"]);
  });

  it("keeps the nearest skill even when nothing else fits", () => {
    expect(frontierSkills(SKILLS, SIZES, { width: 200, height: 300, padding: PAD }, 0.65)).toEqual(["consensus"]);
  });

  it("returns nothing without candidates", () => {
    expect(frontierSkills([], SIZES, PHONE, 0.65)).toEqual([]);
  });
});
