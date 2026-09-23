import { describe, expect, it } from "vitest";
import type { ContentTree } from "@/lib/content/types";
import { habit, item, rank, skill, validTree } from "@/lib/content/__fixtures__/builders";
import { parseValidateArgs, runValidateCli, type ValidateCliDeps } from "./validate-cli";

interface Harness {
  deps: ValidateCliDeps;
  out: () => string;
  err: () => string;
  loaded: string[];
}

function harness(result: ContentTree | Error, isTTY = false): Harness {
  let out = "";
  let err = "";
  const loaded: string[] = [];
  const load = (kind: string) => (p: string) => {
    loaded.push(`${kind}:${p}`);
    if (result instanceof Error) throw result;
    return result;
  };
  return {
    deps: {
      loadTree: load("tree"),
      parseBundleFile: load("bundle"),
      stdout: (s) => {
        out += s;
      },
      stderr: (s) => {
        err += s;
      },
      isTTY,
    },
    out: () => out,
    err: () => err,
    loaded,
  };
}

/** One skill whose only item is time-sensitive, with facts as of `factsAsOf`. */
function timeSensitiveSkillTree(factsAsOf: string): ContentTree {
  const ts = item({ timeSensitive: true, verify: "Check the current inflation band." });
  const sources = [{ title: "Source", url: "https://example.com", note: null, line: 90 }];
  return validTree([skill("b.one", { ranks: [rank(1, [ts])], factsAsOf, sources })]);
}

const withError = (): ContentTree => validTree([skill("b.one", { why: null })]);
const withWarning = (): ContentTree => validTree([skill("b.one", { why: "Short why." })]);

describe("runValidateCli", () => {
  it("loads content/ by default and exits 0 when clean", () => {
    const h = harness(validTree());
    expect(runValidateCli([], h.deps)).toBe(0);
    expect(h.loaded).toEqual(["tree:content"]);
    expect(h.out()).toBe("✔ No errors, no warnings\n");
    expect(h.err()).toBe("");
  });

  it("parses a .md path as a bundle and any other path as a content dir", () => {
    const bundle = harness(validTree());
    runValidateCli(["crypto-finance-the-tie.skilltree.md"], bundle.deps);
    expect(bundle.loaded).toEqual(["bundle:crypto-finance-the-tie.skilltree.md"]);
    const dir = harness(validTree());
    runValidateCli(["--", "other/content"], dir.deps);
    expect(dir.loaded).toEqual(["tree:other/content"]);
  });

  it("exits 1 on errors and 0 on warnings only", () => {
    const bad = harness(withError());
    expect(runValidateCli([], bad.deps)).toBe(1);
    expect(bad.out()).toMatch(/^\s+1\s+error\s+missing-why\s+b\.one has no Why/m);
    expect(bad.out()).toContain("✖ 1 error, no warnings");

    const meh = harness(withWarning());
    expect(runValidateCli([], meh.deps)).toBe(0);
    expect(meh.out()).toContain("✔ No errors, 1 warning");
  });

  it("--json prints diagnostics and summary", () => {
    const h = harness(withError());
    expect(runValidateCli(["--json"], h.deps)).toBe(1);
    const parsed: unknown = JSON.parse(h.out());
    expect(parsed).toEqual({
      diagnostics: [
        expect.objectContaining({ severity: "error", code: "missing-why", file: "content/branches/b/one.md", line: 1, skillId: "b.one" }),
      ],
      summary: { errors: 1, warnings: 0, byCode: { "missing-why": 1 }, searchLinks: 0 },
    });
  });

  it("--quiet keeps errors only, while the summary still counts warnings", () => {
    const t = validTree([skill("b.one", { why: null }), skill("b.two", { why: "Short why." })]);
    const human = harness(t);
    expect(runValidateCli(["--quiet"], human.deps)).toBe(1);
    expect(human.out()).not.toContain("short-why");
    expect(human.out()).toContain("✖ 1 error, 1 warning");

    const json = harness(t);
    runValidateCli(["--json", "-q"], json.deps);
    const parsed = JSON.parse(json.out()) as { diagnostics: Array<{ code: string }>; summary: { warnings: number } };
    expect(parsed.diagnostics.map((d) => d.code)).toEqual(["missing-why"]);
    expect(parsed.summary.warnings).toBe(1);
  });

  it("--today drives the freshness check", () => {
    const fresh = harness(timeSensitiveSkillTree("2026-09-23"));
    runValidateCli(["--today", "2026-12-21"], fresh.deps);
    expect(fresh.out()).not.toContain("stale");
    const stale = harness(timeSensitiveSkillTree("2026-09-23"));
    expect(runValidateCli(["--today=2026-12-22"], stale.deps)).toBe(0);
    expect(stale.out()).toMatch(/warn\s+stale\s+.*90 days ago/);
  });

  it("colours output only on a TTY, never in JSON", () => {
    const tty = harness(withError(), true);
    runValidateCli([], tty.deps);
    expect(tty.out()).toMatch(/\x1b\[/);
    const json = harness(withError(), true);
    runValidateCli(["--json"], json.deps);
    expect(json.out()).not.toMatch(/\x1b\[/);
    const pipe = harness(withError(), false);
    runValidateCli([], pipe.deps);
    expect(pipe.out()).not.toMatch(/\x1b\[/);
  });

  it("exits 2 with usage on bad arguments", () => {
    for (const argv of [["--nope"], ["--today"], ["--today", "tomorrow"], ["a", "b"]]) {
      const h = harness(validTree());
      expect(runValidateCli(argv, h.deps), argv.join(" ")).toBe(2);
      expect(h.err()).toContain("Usage: pnpm validate");
      expect(h.loaded).toEqual([]);
    }
  });

  it("exits 2 when the content can't be read", () => {
    const h = harness(new Error("ENOENT: no such file or directory"));
    expect(runValidateCli(["missing"], h.deps)).toBe(2);
    expect(h.err()).toBe("Could not read missing: ENOENT: no such file or directory\n");
    expect(h.out()).toBe("");
  });

  it("--help prints usage and exits 0", () => {
    const h = harness(validTree());
    expect(runValidateCli(["--help"], h.deps)).toBe(0);
    expect(h.out()).toContain("Usage: pnpm validate");
    expect(h.loaded).toEqual([]);
  });

  it("fails on an untimed habit inside a skill, as in the seed", () => {
    const h = harness(
      validTree([skill("b.one", { ranks: [rank(1, [item(), habit({ minutes: null, timeText: null })])] })]),
    );
    expect(runValidateCli(["--json"], h.deps)).toBe(1);
    const parsed = JSON.parse(h.out()) as { summary: { byCode: Record<string, number> } };
    expect(parsed.summary.byCode).toEqual({ "item-missing-time": 1 });
  });
});

describe("parseValidateArgs", () => {
  it("reads flags in any order", () => {
    expect(parseValidateArgs(["--quiet", "x.skilltree.md", "--json", "--today", "2026-01-02"])).toEqual({
      path: "x.skilltree.md",
      json: true,
      quiet: true,
      today: "2026-01-02",
      help: false,
    });
  });
});
