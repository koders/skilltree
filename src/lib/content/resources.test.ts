import { describe, expect, it } from "vitest";
import { extractLinks, extractResources, normalizeUrl, stripLinks } from "@/lib/content/resources";

describe("extractResources", () => {
  it("finds typed links anywhere in the text, in order", () => {
    const text =
      "[@video@videos](https://timroughgarden.org/videos.html), [@course@course page with readings](https://timroughgarden.github.io/fob21/) and a [plain link](https://example.com)";
    expect(extractResources(text, "Resource")).toEqual([
      { type: "video", title: "videos", url: "https://timroughgarden.org/videos.html", field: "Resource" },
      { type: "course", title: "course page with readings", url: "https://timroughgarden.github.io/fob21/", field: "Resource" },
    ]);
  });

  it("keeps unknown types verbatim and handles parentheses in URLs", () => {
    expect(extractResources("see [@tweet@X](https://en.wikipedia.org/wiki/X_(company))", "Note")).toEqual([
      { type: "tweet", title: "X", url: "https://en.wikipedia.org/wiki/X_(company)", field: "Note" },
    ]);
  });

  it("returns nothing for text without typed links", () => {
    expect(extractResources("[Title](https://a.b) and @search@ text", "title")).toEqual([]);
  });
});

describe("extractLinks / stripLinks / normalizeUrl", () => {
  it("extracts plain and typed links", () => {
    expect(extractLinks("[A](https://a.io/) [@tool@B](https://b.io)")).toEqual([
      { text: "A", url: "https://a.io/" },
      { text: "@tool@B", url: "https://b.io" },
    ]);
  });

  it("strips URLs and type tags", () => {
    expect(stripLinks("Skim [@feed@SR Journal](https://x.io) and [The Tie](https://y.io)")).toBe("Skim SR Journal and The Tie");
  });

  it("normalises trailing slashes", () => {
    expect(normalizeUrl(" https://timroughgarden.github.io/fob21/ ")).toBe("https://timroughgarden.github.io/fob21");
  });
});
