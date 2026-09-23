import { describe, expect, it } from "vitest";
import {
  bulletOf,
  dedent,
  headingOf,
  indentOf,
  isThematicBreak,
  metaOf,
  paragraphsOf,
  shiftHeadings,
  splitFrontmatter,
  splitList,
  splitTableRow,
  stripTrailingId,
  toLines,
} from "@/lib/content/markdown";

describe("toLines", () => {
  it("numbers lines from 1, normalises CRLF and marks fenced code", () => {
    const lines = toLines("a\r\n```\n# x\n```\n# y");
    expect(lines.map((l) => [l.line, l.text, l.fenced])).toEqual([
      [1, "a", false],
      [2, "```", true],
      [3, "# x", true],
      [4, "```", true],
      [5, "# y", false],
    ]);
    expect(headingOf(lines[2])).toBeNull();
    expect(headingOf(lines[4])).toEqual({ depth: 1, text: "y" });
  });

  it("drops a leading byte-order mark so the first line still parses", () => {
    const lines = toLines("\uFEFF# Title\nx");
    expect(lines[0].text).toBe("# Title");
    expect(headingOf(lines[0])).toEqual({ depth: 1, text: "Title" });
    expect(splitFrontmatter(toLines("\uFEFF---\nid: x\n---\n")).yaml).toBe("id: x");
  });
});

describe("line helpers", () => {
  const line = (text: string) => toLines(text)[0];

  it("parses headings", () => {
    expect(headingOf(line("### Rank 1 — Mechanics"))).toEqual({ depth: 3, text: "Rank 1 — Mechanics" });
    expect(headingOf(line("## Closed ##"))).toEqual({ depth: 2, text: "Closed" });
    expect(headingOf(line("#hashtag"))).toBeNull();
  });

  it("parses bullets and metadata", () => {
    expect(bulletOf(line("  - Do: x"))).toEqual({ indent: 2, text: "Do: x" });
    expect(bulletOf(line("1. first"), true)).toEqual({ indent: 0, text: "first" });
    expect(bulletOf(line("---"))).toBeNull();
    expect(metaOf(line("- facts_as_of: 2026-09-23"))).toEqual({ key: "facts_as_of", value: "2026-09-23", line: 1 });
    expect(metaOf(line("- color: #38bdf8"))).toMatchObject({ key: "color", value: "#38bdf8" });
    expect(metaOf(line("- [ ] [read] x"))).toBeNull();
    expect(metaOf(line("- https://x.io"))).toBeNull();
  });

  it("splits id lists", () => {
    expect(splitList("a.b, c.d ,e")).toEqual(["a.b", "c.d", "e"]);
    expect(splitList("—")).toEqual([]);
    expect(splitList("-")).toEqual([]);
    expect(splitList("")).toEqual([]);
  });

  it("measures and removes indentation", () => {
    expect(indentOf("\t  x")).toBe(6);
    expect(dedent("      - deep", 4)).toBe("  - deep");
  });

  it("strips trailing ids", () => {
    expect(stripTrailingId("Title — ~1 h {#my-id} ")).toEqual({ text: "Title — ~1 h", id: "my-id" });
    expect(stripTrailingId("No id")).toEqual({ text: "No id", id: null });
  });

  it("splits table rows with escaped pipes", () => {
    expect(splitTableRow("| 1–3 | A \\| B | x → y |")).toEqual(["1–3", "A | B", "x → y"]);
  });

  it("groups paragraphs without splitting fenced code", () => {
    const ps = paragraphsOf(toLines("a\nb\n\n```\n\n```\n\nc"));
    expect(ps.map((p) => p.map((l) => l.text).join("|"))).toEqual(["a|b", "```||```", "c"]);
  });

  it("shifts headings outside code", () => {
    expect(shiftHeadings("### A\n```\n### B\n```", -1)).toBe("## A\n```\n### B\n```");
  });

  it("only treats an unindented --- as a thematic break", () => {
    expect(isThematicBreak(toLines("---")[0])).toBe(true);
    expect(isThematicBreak(toLines("---  ")[0])).toBe(true);
    expect(isThematicBreak(toLines("    ---")[0])).toBe(false);
    expect(isThematicBreak(toLines("----")[0])).toBe(false);
    expect(isThematicBreak(toLines("```\n---\n```")[1])).toBe(false);
  });

  it("splits frontmatter", () => {
    const split = splitFrontmatter(toLines("---\nid: x\n---\n# Body"));
    expect(split.yaml).toBe("id: x");
    expect(split.body.map((l) => [l.line, l.text])).toEqual([[4, "# Body"]]);
    expect(splitFrontmatter(toLines("---\nid: x")).unterminated).toBe(true);
    expect(splitFrontmatter(toLines("# No frontmatter")).yaml).toBeNull();
  });
});
