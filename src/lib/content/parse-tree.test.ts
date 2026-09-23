import { describe, expect, it } from "vitest";
import { classifyPath, orderSkills, parseTreeFiles } from "@/lib/content/parse-tree";

const skillFile = (branch: string, slug: string, title: string, requires = "—", extra = "") => ({
  path: `content/branches/${branch}/${slug}.md`,
  text: `# ${title}\n- id: ${branch}.${slug}\n- requires: ${requires}\n${extra}`,
});

describe("classifyPath", () => {
  it("recognises the spec §1 layout", () => {
    expect(classifyPath("content/branches/crypto/_branch.md")).toEqual({ kind: "branch", branchDir: "crypto" });
    expect(classifyPath("content/branches/crypto/consensus.md")).toEqual({ kind: "skill", branchDir: "crypto", slug: "consensus" });
    expect(classifyPath("content/quests/the-tie.md")).toEqual({ kind: "quest", slug: "the-tie" });
    expect(classifyPath("content/packs/seed.md")).toEqual({ kind: "pack", id: "seed" });
    expect(classifyPath("content\\branches\\a\\b.md")).toEqual({ kind: "skill", branchDir: "a", slug: "b" });
  });

  it("ignores other files", () => {
    expect(classifyPath("content/README.md")).toBeNull();
    expect(classifyPath("content/branches/crypto/_notes.md")).toBeNull();
    expect(classifyPath("content/branches/crypto/deep/x.md")).toBeNull();
    // READMEs and _drafts are ignored in every folder, not just at the top.
    expect(classifyPath("content/branches/crypto/README.md")).toBeNull();
    expect(classifyPath("content/quests/README.md")).toBeNull();
    expect(classifyPath("content/quests/_draft.md")).toBeNull();
    expect(classifyPath("content/packs/readme.md")).toBeNull();
    expect(classifyPath("content/packs/_notes.md")).toBeNull();
  });
});

describe("parseTreeFiles", () => {
  const files = [
    { path: "content/branches/b/_branch.md", text: "# Beta\n- id: b\n- order: 1\n" },
    { path: "content/branches/a/_branch.md", text: "# Alpha\n- id: a\n" },
    { path: "content/branches/c/_branch.md", text: "# Aardvark\n- id: c\n" },
    skillFile("b", "zeta", "Zeta"),
    skillFile("b", "alpha", "Alpha skill", "b.zeta"),
    skillFile("b", "mid", "Mid skill"),
    skillFile("b", "late", "Aaa late", "b.mid", "\n## Rank 1\n- requires: b.alpha\n"),
    skillFile("a", "one", "One", "b.zeta"),
    { path: "content/README.md", text: "# not content" },
  ];
  const tree = parseTreeFiles(files);

  it("sorts branches by order, then title", () => {
    expect(tree.branches.map((b) => b.id)).toEqual(["b", "c", "a"]);
  });

  it("orders skills topologically by skill and rank requires, ties by title", () => {
    // mid and zeta are ready first (by title: Mid < Zeta); alpha needs zeta; late needs mid and (rank) alpha.
    expect(tree.branches[0].skillIds).toEqual(["b.mid", "b.zeta", "b.alpha", "b.late"]);
    expect(tree.skills.map((s) => s.id)).toEqual(["b.mid", "b.zeta", "b.alpha", "b.late", "a.one"]);
  });

  it("is independent of input order", () => {
    expect(parseTreeFiles([...files].reverse())).toEqual(tree);
  });

  it("reports skills in a folder without _branch.md", () => {
    const t = parseTreeFiles([skillFile("x", "y", "Y")]);
    expect(t.skills.map((s) => s.id)).toEqual(["x.y"]);
    expect(t.diagnostics).toEqual([
      expect.objectContaining({ code: "parse", file: "content/branches/x/y.md", line: 1, skillId: "x.y", message: expect.stringMatching(/no _branch.md/) }),
    ]);
  });

  it("reports sections inside a branch file and uses the folder as fallback id", () => {
    const t = parseTreeFiles([{ path: "content/branches/q/_branch.md", text: "# Q\n\n## Skill in the wrong place\n" }]);
    expect(t.branches[0].id).toBe("q");
    expect(t.diagnostics.map((d) => d.line)).toEqual([3, 1]);
  });

  it("keeps cycles instead of dropping skills", () => {
    const ordered = orderSkills(
      parseTreeFiles([skillFile("a", "x", "X", "a.y"), skillFile("a", "y", "Y", "a.x"), skillFile("a", "z", "Z")]).skills,
    );
    expect(ordered.map((s) => s.id)).toEqual(["a.z", "a.x", "a.y"]);
  });
});
