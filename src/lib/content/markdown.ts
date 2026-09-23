// Line-level markdown helpers shared by the bundle and tree parsers and the
// serializer. Parsing is line-based on purpose: the content format is a small,
// strict subset of markdown, and every node needs its 1-based source line for
// diagnostics (docs/format-spec.md).

export interface SourceLine {
  text: string;
  /** 1-based line number in the file. */
  line: number;
  /** Inside (or delimiting) a fenced code block, so never structural. */
  fenced: boolean;
}

export interface Heading {
  depth: number;
  text: string;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function toLines(text: string, firstLine = 1): SourceLine[] {
  const out: SourceLine[] = [];
  let fence: { char: string; length: number } | null = null;
  // Some Windows editors save a byte-order mark, which would hide the first `#` or `---`.
  normalizeNewlines(text.replace(/^\uFEFF/, ""))
    .split("\n")
    .forEach((raw, i) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(raw);
      let fenced = fence !== null;
      if (marker) {
        const char = marker[1][0];
        const length = marker[1].length;
        if (fence === null) {
          fence = { char, length };
          fenced = true;
        } else if (char === fence.char && length >= fence.length && raw.trim() === marker[1]) {
          fence = null;
          fenced = true;
        }
      }
      out.push({ text: raw, line: firstLine + i, fenced });
    });
  return out;
}

export function isBlank(l: SourceLine): boolean {
  return l.text.trim() === "";
}

export function headingOf(l: SourceLine): Heading | null {
  if (l.fenced) return null;
  const m = /^(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(l.text);
  if (!m) return null;
  return { depth: m[1].length, text: (m[2] ?? "").trim() };
}

/**
 * An unindented `---`: closes a bundle branch or quest (spec §8). Indented
 * ones belong to the item or list they sit in, so they never close anything.
 */
export function isThematicBreak(l: SourceLine): boolean {
  return !l.fenced && l.text.trimEnd() === "---";
}

/**
 * Verbatim text written into a bundle must not contain a closing `---`;
 * `----` renders the same (a rule, or a setext underline) but closes nothing.
 */
export function escapeThematicBreaks(body: string): string {
  if (!body.includes("---")) return body;
  return toLines(body)
    .map((l) => (isThematicBreak(l) ? `${l.text.trimEnd()}-` : l.text))
    .join("\n");
}

/** Leading whitespace width; a tab counts as 4 columns. */
export function indentOf(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (ch === " ") width += 1;
    else if (ch === "\t") width += 4;
    else break;
  }
  return width;
}

/** Removes up to `columns` columns of leading whitespace. */
export function dedent(text: string, columns: number): string {
  let width = 0;
  let i = 0;
  while (i < text.length && width < columns) {
    const ch = text[i];
    if (ch === " ") width += 1;
    else if (ch === "\t") width += 4;
    else break;
    i += 1;
  }
  return text.slice(i);
}

export interface Bullet {
  indent: number;
  text: string;
}

/** `- text`, `* text`, `+ text` (and `1. text` when `ordered`). */
export function bulletOf(l: SourceLine, ordered = false): Bullet | null {
  if (l.fenced) return null;
  const m = ordered
    ? /^(\s*)(?:[-*+]|\d+[.)])(?:[ \t]+(.*))?$/.exec(l.text)
    : /^(\s*)[-*+](?:[ \t]+(.*))?$/.exec(l.text);
  if (!m) return null;
  return { indent: indentOf(m[1]), text: (m[2] ?? "").trim() };
}

export interface MetaEntry {
  key: string;
  value: string;
  line: number;
}

const META_RE = /^[-*+][ \t]+([A-Za-z_][A-Za-z0-9_-]*)[ \t]*:(?:[ \t]+(.*?))?[ \t]*$/;

/** `- key: value` at column 0. */
export function metaOf(l: SourceLine): MetaEntry | null {
  if (l.fenced) return null;
  const m = META_RE.exec(l.text);
  if (!m) return null;
  return { key: m[1], value: (m[2] ?? "").trim(), line: l.line };
}

const NONE_VALUES = new Set(["", "—", "–", "-", "none"]);

/** Comma-separated ids; `—`, `-` or empty mean none. */
export function splitList(value: string): string[] {
  if (NONE_VALUES.has(value.trim().toLowerCase())) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => !NONE_VALUES.has(s.toLowerCase()));
}

export function isNoneValue(value: string): boolean {
  return NONE_VALUES.has(value.trim().toLowerCase());
}

export function trimBlankLines(lines: SourceLine[]): SourceLine[] {
  let start = 0;
  let end = lines.length;
  while (start < end && isBlank(lines[start]) && !lines[start].fenced) start += 1;
  while (end > start && isBlank(lines[end - 1]) && !lines[end - 1].fenced) end -= 1;
  return lines.slice(start, end);
}

export function joinLines(lines: SourceLine[]): string {
  return lines.map((l) => l.text).join("\n");
}

/** Groups lines into paragraphs separated by blank lines (blank lines inside fences don't split). */
export function paragraphsOf(lines: SourceLine[]): SourceLine[][] {
  const out: SourceLine[][] = [];
  let current: SourceLine[] = [];
  for (const l of lines) {
    if (isBlank(l) && !l.fenced) {
      if (current.length) out.push(current);
      current = [];
    } else {
      current.push(l);
    }
  }
  if (current.length) out.push(current);
  return out;
}

/**
 * Shifts ATX headings in a markdown body by `delta` levels (clamped to 1..6).
 * Verbatim section bodies are stored at tree-shape depth, and a bundle nests
 * everything one level deeper (spec §1).
 */
export function shiftHeadings(body: string, delta: number): string {
  if (delta === 0 || body === "") return body;
  return toLines(body)
    .map((l) => {
      const h = headingOf(l);
      if (!h) return l.text;
      const depth = Math.min(6, Math.max(1, h.depth + delta));
      return l.text.replace(/^#{1,6}/, "#".repeat(depth));
    })
    .join("\n");
}

/** Removes a trailing `{#id}` from `text`. */
export function stripTrailingId(text: string): { text: string; id: string | null } {
  const m = /\s*\{#([^\s{}]+)\}\s*$/.exec(text);
  if (!m) return { text, id: null };
  return { text: text.slice(0, m.index), id: m[1] };
}

// ------------------------------------------------------------------- tables

export function isTableLine(l: SourceLine): boolean {
  return !l.fenced && l.text.trim().startsWith("|");
}

export function splitTableRow(text: string): string[] {
  let row = text.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (ch === "\\" && row[i + 1] === "|") {
      current += "|";
      i += 1;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function isTableSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

export function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

// -------------------------------------------------------------- frontmatter

export interface FrontmatterSplit {
  /** Raw YAML between the `---` fences, or null when the file has none. */
  yaml: string | null;
  /** Line of the opening `---`. */
  yamlLine: number;
  body: SourceLine[];
  /** True when the opening fence has no closing fence. */
  unterminated: boolean;
}

export function splitFrontmatter(lines: SourceLine[]): FrontmatterSplit {
  if (lines.length === 0 || lines[0].text.trim() !== "---") {
    return { yaml: null, yamlLine: 0, body: lines, unterminated: false };
  }
  const close = lines.findIndex((l, i) => i > 0 && (l.text.trim() === "---" || l.text.trim() === "..."));
  if (close < 0) return { yaml: null, yamlLine: lines[0].line, body: lines, unterminated: true };
  return {
    yaml: joinLines(lines.slice(1, close)),
    yamlLine: lines[0].line,
    body: lines.slice(close + 1),
    unterminated: false,
  };
}
