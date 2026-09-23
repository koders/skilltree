// Typed resource links, roadmap.sh-style `[@type@Title](url)` (spec §3), and
// plain markdown links (used to match pack sources to skills on import).

import type { Resource } from "@/lib/content/types";

// A URL may contain one level of balanced parentheses (e.g. Wikipedia links).
const URL = String.raw`((?:[^()\s]|\([^()\s]*\))+)`;
const TITLE_ATTR = String.raw`(?:\s+"[^"]*")?`;

export function extractResources(text: string, field: string): Resource[] {
  const re = new RegExp(String.raw`\[@([A-Za-z][\w-]*)@([^\]]*)\]\(\s*${URL}${TITLE_ATTR}\s*\)`, "g");
  const out: Resource[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ type: m[1], title: m[2].trim(), url: m[3], field });
  }
  return out;
}

export interface MarkdownLink {
  /** Link text as written (typed links keep their `@type@` prefix). */
  text: string;
  url: string;
}

export function extractLinks(text: string): MarkdownLink[] {
  const re = new RegExp(String.raw`\[([^\]]*)\]\(\s*${URL}${TITLE_ATTR}\s*\)`, "g");
  const out: MarkdownLink[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ text: m[1], url: m[2] });
  return out;
}

/** For matching the same page across files: trims whitespace and trailing slashes. */
export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Link text without `@type@` tags and URLs: `[@podcast@Epicenter](…)` → `Epicenter`. */
export function stripLinks(text: string): string {
  return text.replace(new RegExp(String.raw`\[(?:@[A-Za-z][\w-]*@)?([^\]]*)\]\(\s*${URL}${TITLE_ATTR}\s*\)`, "g"), "$1");
}
