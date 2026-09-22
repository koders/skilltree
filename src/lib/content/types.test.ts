import { describe, expect, it } from "vitest";
import { isItemType, isResourceType } from "@/lib/content/types";

describe("type guards", () => {
  it("recognises item and resource types", () => {
    expect(isItemType("build")).toBe(true);
    expect(isItemType("lecture")).toBe(false);
    expect(isResourceType("search")).toBe(true);
    expect(isResourceType("tweet")).toBe(false);
  });
});
