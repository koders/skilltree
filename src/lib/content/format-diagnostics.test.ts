import { describe, expect, it } from "vitest";
import type { Diagnostic } from "@/lib/content/types";
import { formatDiagnostics, formatSummary } from "@/lib/content/format-diagnostics";

const ANSI = /\x1b\[[0-9;]*m/;

const diags: Diagnostic[] = [
  { severity: "error", code: "cycle", message: "Prerequisite cycle: a → b → a", file: "content/a.md", line: 3 },
  { severity: "warning", code: "search-links", message: "2 @search@ links to resolve into exact videos (line 12)", file: "content/a.md", line: 120 },
  { severity: "warning", code: "short-why", message: "Why is short", file: "content/b.md", line: 1 },
];

describe("formatDiagnostics", () => {
  it("groups by file with aligned rows and ends with a summary", () => {
    expect(formatDiagnostics(diags).split("\n")).toEqual([
      "content/a.md",
      "    3  error  cycle         Prerequisite cycle: a → b → a",
      "  120  warn   search-links  2 @search@ links to resolve into exact videos (line 12)",
      "",
      "content/b.md",
      "  1  warn   short-why  Why is short",
      "",
      "✖ 1 error, 2 warnings (2 @search@ links to resolve)",
    ]);
  });

  it("prints only the summary when there is nothing to report", () => {
    expect(formatDiagnostics([])).toBe("✔ No errors, no warnings");
  });

  it("uses a tick summary when there are only warnings", () => {
    expect(formatDiagnostics(diags.slice(1)).split("\n").at(-1)).toBe(
      "✔ No errors, 2 warnings (2 @search@ links to resolve)",
    );
  });

  it("quiet mode hides warnings but still counts them", () => {
    const out = formatDiagnostics(diags, { quiet: true });
    expect(out).not.toContain("short-why");
    expect(out).not.toContain("content/b.md");
    expect(out).toContain("cycle");
    expect(out.split("\n").at(-1)).toBe("✖ 1 error, 2 warnings (2 @search@ links to resolve)");
  });

  it("handles diagnostics without a file or line", () => {
    const out = formatDiagnostics([{ severity: "error", code: "parse", message: "Bad frontmatter" }]);
    expect(out.split("\n").slice(0, 2)).toEqual(["(no file)", "  -  error  parse  Bad frontmatter"]);
  });

  it("colours only when asked", () => {
    expect(formatDiagnostics(diags)).not.toMatch(ANSI);
    const coloured = formatDiagnostics(diags, { color: true });
    expect(coloured).toMatch(ANSI);
    expect(coloured.replace(new RegExp(ANSI.source, "g"), "")).toBe(formatDiagnostics(diags));
  });
});

describe("formatSummary", () => {
  it("pluralises and omits the @search@ note when there are none", () => {
    expect(formatSummary({ errors: 2, warnings: 1, byCode: {}, searchLinks: 0 })).toBe("✖ 2 errors, 1 warning");
    expect(formatSummary({ errors: 0, warnings: 0, byCode: {}, searchLinks: 1 })).toBe(
      "✔ No errors, no warnings (1 @search@ link to resolve)",
    );
  });
});
