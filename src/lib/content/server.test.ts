import { afterEach, describe, expect, it, vi } from "vitest";

const { loadContentTree } = vi.hoisted(() => ({
  loadContentTree: vi.fn(() => ({ branches: [], skills: [], quests: [], packs: [], diagnostics: [], shape: "tree" as const })),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/load", () => ({ loadContentTree }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  loadContentTree.mockClear();
});

describe("getContent", () => {
  it("re-reads content on every call outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { getContent } = await import("@/lib/content/server");
    const first = getContent();
    getContent();
    expect(loadContentTree).toHaveBeenCalledTimes(2);
    expect(first.index.tree).toBe(first.tree);
  });

  it("memoises in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getContent } = await import("@/lib/content/server");
    expect(getContent()).toBe(getContent());
    expect(loadContentTree).toHaveBeenCalledTimes(1);
  });
});
